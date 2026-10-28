// Exercise the deployed EmailService and Nunjucks renderer. Only the external
// SMTP transport is replaced; no provider connection or real email is made.
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
let rendered;
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    rendered = message.html;
    return { messageId: 'worker-template-smoke' };
  },
});
const { ConfigService } = require('@nestjs/config');
const { EmailService } = require('../../dist/modules/email/email.service');
const { EmailTemplateID } = require('../../dist/constants/email-constants');

async function main() {
  const service = new EmailService(
    new ConfigService({ mail: { mailer: 'smtp' } }),
  );
  for (const template of [
    EmailTemplateID.VERIFICATION_CODE,
    EmailTemplateID.OTP,
  ]) {
    rendered = undefined;
    await service.sendMail({
      from: { email: 'sender@example.invalid' },
      to: [{ email: 'recipient@example.invalid' }],
      subject: 'Worker template smoke test',
      templateNameID: template,
      templateData: {
        name: 'Worker template smoke',
        app_name: 'OHealth',
        code: '123456',
        otp: '123456',
        otp_digits: ['1', '2', '3', '4', '5', '6'],
        verification_url: 'https://example.invalid/verify?challenge_id=smoke',
        expiry_minutes: 10,
      },
    });
    assert.match(rendered, /Worker template smoke/);
    assert.match(rendered, /<html/);
    assert.doesNotMatch(rendered, /\{\{|\{%/);
  }
  process.stdout.write(
    'Worker verification and recovery templates rendered successfully.\n',
  );
}
main().catch(() => {
  process.stderr.write('Worker template smoke test failed.\n');
  process.exitCode = 1;
});
