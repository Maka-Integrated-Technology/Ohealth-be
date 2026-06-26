import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as nunjucks from 'nunjucks';
import { Resend } from 'resend';

import { EmailPayload } from './email.types';

/** The provider-agnostic message a driver knows how to deliver. */
type DriverMessage = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
};

/** A send strategy. Returns the provider's message id for logging. */
type EmailDriver = (message: DriverMessage) => Promise<string>;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly mailer: string;
  private readonly send: EmailDriver;

  constructor(private readonly configService: ConfigService) {
    this.mailer = this.configService.get<string>('mail.mailer') ?? 'smtp';

    // Resolve the driver once, up front, so the hot path has no branching.
    this.send =
      this.mailer === 'resend'
        ? this.createResendDriver()
        : this.createSmtpDriver();
  }

  /** Resend HTTP API — used for production and staging. */
  private createResendDriver(): EmailDriver {
    const apiKey = this.configService.get<string>('mail.resendApiKey');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when MAIL_MAILER=resend');
    }
    const resend = new Resend(apiKey);

    return async ({ from, to, subject, html, text }) => {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
      });
      if (error) {
        throw new Error(`${error.name}: ${error.message}`);
      }
      return data?.id ?? '';
    };
  }

  /** SMTP transport — used for local dev against Mailpit. */
  private createSmtpDriver(): EmailDriver {
    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<number>('mail.port') === 465,

      auth: {
        user: this.configService.get<string>('mail.username') || undefined,
        pass: this.configService.get<string>('mail.password') || undefined,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      pool: true,
      maxConnections: 5,
    });

    return async ({ from, to, subject, html, text }) => {
      const info = await transporter.sendMail({
        from,
        to: to.join(', '),
        subject,
        html,
        text, // Optional plain-text version
      });
      return info.messageId;
    };
  }

  /**
   * Compiles an email template using Nunjucks.
   * @param templateName The filename of the template (e.g., "welcome.njk")
   * @param context The data to inject
   * @returns The compiled HTML string
   */
  private async compileTemplate(
    templateName: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const templatePath = path.join(
      process.cwd(),
      'dist',
      'templates',
      templateName,
    );

    try {
      const template = await fs.readFile(templatePath, 'utf-8');

      const fullContext = {
        ...context,
        copyRightYear: new Date().getFullYear(),
      };

      return nunjucks.renderString(template, fullContext);
    } catch (error) {
      this.logger.error(
        `Error reading or compiling template at: ${templatePath}`,
        error,
      );
      throw new Error('Could not load or compile email template.');
    }
  }

  /**
   * Sends an email using the provided payload.
   * This is the main public method for this service.
   * @param payload The EmailPayload object
   */
  async sendMail(payload: EmailPayload): Promise<void> {
    const { from, to, subject, templateNameID, templateData, text } = payload;

    const html = await this.compileTemplate(templateNameID, templateData);

    const fromAddress =
      from?.email ?? this.configService.get<string>('mail.from.address');
    const fromName =
      from?.name ??
      this.configService.get<string>('mail.from.name') ??
      'OHealth';

    const fromHeader = `"${fromName}" <${fromAddress}>`;
    const toHeader = to.map((t) =>
      t.name ? `"${t.name}" <${t.email}>` : t.email,
    );

    try {
      const messageId = await this.send({
        from: fromHeader,
        to: toHeader,
        subject,
        html,
        text,
      });
      this.logger.log(
        `Email sent successfully to ${toHeader.join(', ')}: ${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${toHeader.join(', ')}`,
        error,
      );
      throw error;
    }
  }
}
