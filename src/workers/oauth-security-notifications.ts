import { ConfigService } from '@nestjs/config';

import config from '../config/config';
import { initializeDataSource } from '../database/data-source';
import { EmailService } from '../modules/email/email.service';
import { OAuthSecurityNotificationService } from '../modules/auth/oauth/oauth-security-notification.service';

async function main(): Promise<void> {
  const dataSource = await initializeDataSource();
  try {
    const settings = new ConfigService(config());
    const processed = await new OAuthSecurityNotificationService(
      dataSource,
      new EmailService(settings),
    ).dispatchBatch();
    process.stdout.write(
      `OAuth security notifications processed=${processed}\n`,
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch(() => {
  process.stderr.write('OAuth security notification dispatch failed.\n');
  process.exitCode = 1;
});
