import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { EmailTemplateID } from '../../../constants/email-constants';
import { EmailService } from '../../email/email.service';
import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../platform-events/enums/outbox-event-status.enum';
import { User } from '../../user/entities/user.entity';

/** Dispatches pointer-only authenticator-change events with bounded retries. */
@Injectable()
export class OAuthSecurityNotificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly email: EmailService,
  ) {}

  async dispatchBatch(limit = 20): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Invalid notification batch size.');
    }
    let processed = 0;
    for (let index = 0; index < limit; index++) {
      const found = await this.dataSource.transaction(async (manager) => {
        const event = await manager
          .createQueryBuilder(OutboxEvent, 'event')
          .where('event.event_type = :eventType', {
            eventType: 'oauth_google_unlinked',
          })
          .andWhere('event.status = :status', { status: 'pending' })
          .andWhere('event.available_at <= now()')
          .orderBy('event.available_at', 'ASC')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getOne();
        if (!event) return false;
        const user = event.aggregate_id
          ? await manager.findOne(User, { where: { id: event.aggregate_id } })
          : null;
        if (!user?.email_verified_at) {
          event.status = OutboxEventStatus.FAILED;
          event.processed_at = new Date();
          await manager.save(event);
          return true;
        }
        try {
          await this.email.sendMail({
            to: [{ email: user.email }],
            subject: 'Your OHealth sign-in method changed',
            templateNameID: EmailTemplateID.SECURITY_AUTHENTICATOR_CHANGED,
            templateData: {},
          });
          event.status = OutboxEventStatus.PUBLISHED;
          event.processed_at = new Date();
        } catch {
          event.attempts += 1;
          event.status =
            event.attempts >= 5
              ? OutboxEventStatus.FAILED
              : OutboxEventStatus.PENDING;
          event.available_at = new Date(
            Date.now() + Math.min(3600, 30 * 2 ** event.attempts) * 1000,
          );
          if (event.status === OutboxEventStatus.FAILED)
            event.processed_at = new Date();
        }
        await manager.save(event);
        return true;
      });
      if (!found) break;
      processed += 1;
    }
    return processed;
  }
}
