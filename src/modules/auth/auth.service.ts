import * as crypto from 'crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Logger } from 'winston';

import { IRequestWithUser } from '../../common/types';
import { EmailTemplateID } from '../../constants/email-constants';
import * as sysMsg from '../../constants/system.messages';
import { EmailService } from '../email/email.service';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';
import { UserService } from '../user/user.service';

import {
  AuthDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifySignupDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { AuthSession } from './entities/auth.entity';

interface IRefreshPayload {
  sub: string;
  email: string;
  role: UserRole[] | UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger: Logger;
  private readonly saltRounds: number;

  constructor(
    private readonly userService: UserService,
    @InjectRepository(AuthSession)
    private readonly sessionRepository: Repository<AuthSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: AuthService.name });
    this.saltRounds = Number(this.configService.get<string>('HASH_SALT', '10'));
  }

  async signup(signupPayload: AuthDto) {
    const email = signupPayload.email.trim().toLowerCase();
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException(sysMsg.ACCOUNT_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(
      signupPayload.password,
      this.saltRounds,
    );
    const verificationCode = this.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const savedUser = await this.userService.create({
      email,
      password: hashedPassword,
      first_name: signupPayload.first_name.trim(),
      last_name: signupPayload.last_name.trim(),
      middle_name: signupPayload.middle_name?.trim() || null,
      gender: signupPayload.gender ?? null,
      dob: signupPayload.dob ?? null,
      phone: signupPayload.phone ?? null,
      role: signupPayload.role?.length
        ? signupPayload.role
        : [UserRole.PATIENT],
      is_active: false,
      is_verified: false,
      verification_code: verificationCode,
      verification_code_expires_at: verificationExpiry,
    });
    const tokens = await this.generateTokens(
      savedUser.id,
      savedUser.email,
      savedUser.role,
    );
    const session = await this.createSession(
      savedUser.id,
      tokens.refresh_token,
    );

    this.logger.info(sysMsg.ACCOUNT_CREATED);
    void this.sendVerificationEmail(savedUser, verificationCode, 10);

    return {
      message: sysMsg.VERIFICATION_CODE_SENT,
      user: this.toUserResponse(savedUser),
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  async login(loginPayload: LoginDto) {
    const email = loginPayload.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }

    if (!user.is_active || !user.is_verified) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }

    const isPasswordValid = await bcrypt.compare(
      loginPayload.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const session = await this.createSession(user.id, tokens.refresh_token);

    this.logger.info(sysMsg.LOGIN_SUCCESS);

    return {
      message: sysMsg.LOGIN_SUCCESS,
      user: this.toUserResponse(user),
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  async refreshToken(refreshToken: RefreshTokenDto) {
    let payload: IRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<IRefreshPayload>(
        refreshToken.refresh_token,
        {
          secret: this.getRefreshSecret(),
        },
      );
    } catch {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const session = await this.sessionRepository.findOne({
      where: {
        user_id: payload.sub,
        refresh_token_hash: this.hashToken(refreshToken.refresh_token),
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
    });

    if (!session) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    const tokens = await this.generateTokens(payload.sub, payload.email, roles);

    session.revoked_at = new Date();
    await this.sessionRepository.save(session);
    const newSession = await this.createSession(
      payload.sub,
      tokens.refresh_token,
    );

    this.logger.info(sysMsg.TOKEN_REFRESH_SUCCESS);

    return {
      message: sysMsg.TOKEN_REFRESH_SUCCESS,
      ...tokens,
      session_id: newSession.session_id,
      session_expires_at: newSession.expires_at,
    };
  }

  async forgotPassword(
    payload: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const email = payload.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);

    if (user) {
      const resetCode = this.generateVerificationCode();
      user.reset_token = resetCode;
      user.reset_token_expiry = new Date(Date.now() + 10 * 60 * 1000);
      await this.userService.save(user);

      this.logger.info(`Password reset token generated for user ${user.id}`);
      void this.sendPasswordResetEmail(user, resetCode, 10);
    }

    return {
      message: sysMsg.PASSWORD_RESET_CODE_SENT,
    };
  }

  async resetPassword(payload: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(payload.token);

    if (
      !user ||
      !user.reset_token_expiry ||
      user.reset_token_expiry < new Date()
    ) {
      throw new BadRequestException(sysMsg.TOKEN_INVALID);
    }

    user.password = await bcrypt.hash(payload.newPassword, this.saltRounds);
    user.reset_token = null;
    user.reset_token_expiry = null;
    await this.userService.save(user);

    await this.sessionRepository
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revoked_at: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('revoked_at IS NULL')
      .execute();

    return {
      message: sysMsg.PASSWORD_RESET_SUCCESS,
    };
  }

  async activateUserAccount(id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(sysMsg.USER_NOT_FOUND);
    }

    if (user.is_active) {
      return sysMsg.USER_IS_ACTIVATED;
    }

    user.is_active = true;
    await this.userService.save(user);
    return sysMsg.USER_ACTIVATED;
  }

  async verifySignup(payload: VerifySignupDto) {
    const email = payload.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException(sysMsg.USER_NOT_FOUND);
    }

    if (!user.verification_code || !user.verification_code_expires_at) {
      throw new BadRequestException(sysMsg.INVALID_VERIFICATION_CODE);
    }

    if (user.verification_code !== payload.code) {
      throw new BadRequestException(sysMsg.INVALID_VERIFICATION_CODE);
    }

    if (user.verification_code_expires_at < new Date()) {
      throw new BadRequestException(sysMsg.VERIFICATION_CODE_EXPIRED);
    }

    user.is_active = true;
    user.is_verified = true;
    user.verification_code = null;
    user.verification_code_expires_at = null;
    await this.userService.save(user);

    void this.sendWelcomeEmail(user);

    return { message: sysMsg.ACCOUNT_VERIFIED };
  }

  async getProfile(req: IRequestWithUser) {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      this.logger.warn(sysMsg.USER_NOT_FOUND);
      throw new UnauthorizedException(sysMsg.USER_NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      role: user.role,
      gender: user.gender,
      dob: user.dob,
      phone: user.phone,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async logout(logoutPayload: LogoutDto) {
    const session = await this.sessionRepository.findOne({
      where: {
        session_id: logoutPayload.session_id,
        user_id: logoutPayload.user_id,
        revoked_at: IsNull(),
      },
    });

    if (session) {
      session.revoked_at = new Date();
      await this.sessionRepository.save(session);
    }

    this.logger.info(sysMsg.LOGOUT_SUCCESS);

    return {
      message: sysMsg.LOGOUT_SUCCESS,
    };
  }

  async googleLogin(token: string) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    let payload: {
      email?: string;
      sub?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    } | null;
    try {
      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    const email = payload.email.toLowerCase();
    const derivedName = this.deriveNameFromGoogle(payload);
    let user = await this.userService.findByEmail(email);
    let isNewUser = false;

    if (!user) {
      const generatedPassword = crypto.randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(
        generatedPassword,
        this.saltRounds,
      );

      isNewUser = true;
      user = await this.userService.create({
        email,
        password: hashedPassword,
        first_name: derivedName.firstName,
        last_name: derivedName.lastName,
        middle_name: null,
        gender: null,
        dob: null,
        phone: null,
        role: [UserRole.PATIENT],
        is_active: true,
        is_verified: true,
        google_id: payload.sub,
      });
    } else {
      const defaultFirst = 'HealthBridge';
      const defaultLast = 'User';
      const shouldUpdateFirst =
        !user.first_name || user.first_name === defaultFirst;
      const shouldUpdateLast =
        !user.last_name || user.last_name === defaultLast;
      const shouldUpdateGoogleId = !user.google_id;

      if (shouldUpdateGoogleId) {
        user.google_id = payload.sub;
      }
      if (shouldUpdateFirst) {
        user.first_name = derivedName.firstName;
      }
      if (shouldUpdateLast) {
        user.last_name = derivedName.lastName;
      }

      if (shouldUpdateGoogleId || shouldUpdateFirst || shouldUpdateLast) {
        user = await this.userService.save(user);
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const session = await this.createSession(user.id, tokens.refresh_token);

    if (isNewUser) {
      void this.sendWelcomeEmail(user);
    }

    return {
      message: sysMsg.LOGIN_SUCCESS,
      user: {
        ...this.toUserResponse(user),
        picture: payload.picture,
      },
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  private deriveNameFromGoogle(payload: {
    given_name?: string;
    family_name?: string;
    name?: string;
    email?: string;
  }): { firstName: string; lastName: string } {
    const given = this.cleanName(payload.given_name);
    const family = this.cleanName(payload.family_name);
    const fromEmail = this.splitEmailLocalPart(payload.email);
    const emailFirst = fromEmail?.firstName;
    const emailLast = fromEmail?.lastName;

    if (given || family) {
      return {
        firstName:
          given ||
          this.firstFromFullName(payload.name) ||
          emailFirst ||
          'HealthBridge',
        lastName:
          family || this.lastFromFullName(payload.name) || emailLast || 'User',
      };
    }

    const fullName = this.splitFullName(payload.name);
    if (fullName) {
      return fullName;
    }

    if (fromEmail) {
      return fromEmail;
    }

    return { firstName: 'HealthBridge', lastName: 'User' };
  }

  private cleanName(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private splitFullName(
    fullName?: string,
  ): { firstName: string; lastName: string } | null {
    const trimmed = fullName?.trim();
    if (!trimmed) {
      return null;
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return null;
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: 'User' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private firstFromFullName(fullName?: string): string | null {
    return this.splitFullName(fullName)?.firstName ?? null;
  }

  private lastFromFullName(fullName?: string): string | null {
    return this.splitFullName(fullName)?.lastName ?? null;
  }

  private splitEmailLocalPart(
    email?: string,
  ): { firstName: string; lastName: string } | null {
    if (!email) {
      return null;
    }
    const localPart = email.split('@')[0]?.replace(/\+.*$/, '');
    if (!localPart) {
      return null;
    }
    const parts = localPart
      .split(/[._-]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) {
      return null;
    }
    const firstName = this.titleCase(parts[0]);
    const lastName =
      parts.length > 1 ? this.titleCase(parts.slice(1).join(' ')) : 'User';
    return { firstName, lastName };
  }

  private titleCase(value: string): string {
    if (!value) {
      return value;
    }
    return value
      .toLowerCase()
      .split(' ')
      .map((word) => {
        const [first, ...rest] = word.split('');
        return first ? `${first.toUpperCase()}${rest.join('')}` : word;
      })
      .join(' ');
  }

  private async sendWelcomeEmail(user: User) {
    const appName =
      this.configService.get<string>('app.name') || 'HealthBridge';
    const fromAddress = this.configService.get<string>('mail.from.address');
    const fromName = this.configService.get<string>('mail.from.name');

    if (!fromAddress) {
      this.logger.warn('Welcome email not sent: MAIL_FROM_ADDRESS not set.');
      return;
    }

    try {
      await this.emailService.sendMail({
        from: { email: fromAddress, name: fromName },
        to: [{ email: user.email, name: user.first_name }],
        subject: `Welcome to ${appName}`,
        templateNameID: EmailTemplateID.WELCOME,
        templateData: {
          name: user.first_name,
          app_name: appName,
        },
      });
      this.logger.info('Welcome email sent', { email: user.email });
    } catch (error) {
      this.logger.error('Failed to send welcome email', error);
    }
  }

  private async sendVerificationEmail(
    user: User,
    code: string,
    expiryMinutes: number,
  ) {
    const appName =
      this.configService.get<string>('app.name') || 'HealthBridge';
    const fromAddress = this.configService.get<string>('mail.from.address');
    const fromName = this.configService.get<string>('mail.from.name');

    if (!fromAddress) {
      this.logger.warn(
        'Verification email not sent: MAIL_FROM_ADDRESS not set.',
      );
      return;
    }

    try {
      await this.emailService.sendMail({
        from: { email: fromAddress, name: fromName },
        to: [{ email: user.email, name: user.first_name }],
        subject: `Verify your ${appName} account`,
        templateNameID: EmailTemplateID.VERIFICATION_CODE,
        templateData: {
          name: user.first_name,
          app_name: appName,
          code,
          expiry_minutes: expiryMinutes,
        },
      });
      this.logger.info('Verification email sent', { email: user.email });
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
    }
  }

  private generateVerificationCode(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  private async sendPasswordResetEmail(
    user: User,
    code: string,
    expiryMinutes: number,
  ) {
    const appName =
      this.configService.get<string>('app.name') || 'HealthBridge';
    const fromAddress = this.configService.get<string>('mail.from.address');
    const fromName = this.configService.get<string>('mail.from.name');
    const frontendUrl = this.configService.get<string>('frontend.url');
    const resetUrl = frontendUrl
      ? `${frontendUrl}/reset-password?code=${code}`
      : undefined;

    if (!fromAddress) {
      this.logger.warn(
        'Password reset email not sent: MAIL_FROM_ADDRESS not set.',
      );
      return;
    }

    try {
      await this.emailService.sendMail({
        from: { email: fromAddress, name: fromName },
        to: [{ email: user.email, name: user.first_name }],
        subject: `Reset your ${appName} password`,
        templateNameID: EmailTemplateID.OTP,
        templateData: {
          name: user.first_name,
          app_name: appName,
          otp: code,
          otp_digits: code.split(''),
          reset_url: resetUrl,
          expiry_minutes: expiryMinutes,
        },
      });
      this.logger.info('Password reset email sent', { email: user.email });
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    roles: UserRole[],
  ) {
    const payload = { sub: userId, email, role: roles };
    const accessExpiresIn = this.parseDurationToSeconds(
      this.configService.get<string>('TOKEN_ACCESS_DURATION', '15m'),
      900,
    );
    const refreshExpiresIn = this.parseDurationToSeconds(
      this.configService.get<string>('TOKEN_REFRESH_DURATION', '7d'),
      604800,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getAccessSecret(),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getRefreshSecret(),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async createSession(userId: string, refreshToken: string) {
    const session = this.sessionRepository.create({
      session_id: crypto.randomUUID(),
      user_id: userId,
      refresh_token_hash: this.hashToken(refreshToken),
      expires_at: this.getTokenExpiry(refreshToken),
      revoked_at: null,
    });
    return this.sessionRepository.save(session);
  }

  private toUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getTokenExpiry(token: string): Date {
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private getAccessSecret() {
    return this.configService.get<string>('JWT_SECRET', 'change_me');
  }

  private getRefreshSecret() {
    return this.configService.get<string>('JWT_REFRESH_SECRET', 'change_me');
  }

  private parseDurationToSeconds(
    value: string,
    fallbackSeconds: number,
  ): number {
    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }

    const match = normalized.match(/^(\d+)([smhd])$/i);
    if (!match) {
      return fallbackSeconds;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return amount * multipliers[unit];
  }
}
