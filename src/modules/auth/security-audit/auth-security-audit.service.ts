import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { AuthSecurityEvent } from './auth-security-event.entity';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
  AuthSecurityRequestSource,
} from './auth-security-event.enum';

export interface IAuthSecurityAuditInput {
  event_type: AuthSecurityEventType;
  outcome: AuthSecurityEventOutcome;
  actor_user_id?: string | null;
  subject_user_id?: string | null;
  session_id?: string | null;
  request_source?: AuthSecurityRequestSource;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * This is a separate audit channel, not the general application logger.
 * Accept a small fixed schema only: never accept request bodies, headers,
 * tokens, emails, error text or arbitrary JSON metadata.
 */
@Injectable()
export class AuthSecurityAuditService {
  constructor(private readonly dataSource: DataSource) {}

  async recordInTransaction(
    manager: EntityManager,
    input: IAuthSecurityAuditInput,
  ): Promise<void> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('Security audit writes require an active transaction.');
    }
    const entry = this.toSafeEvent(input);
    // Allow an insert error to abort the *same* security transaction.
    // Swallowing it would silently leave unaudited state changes committed.
    await manager.insert(AuthSecurityEvent, entry);
  }

  /** For failures without a corresponding business-state transaction. */
  async recordAttempt(input: IAuthSecurityAuditInput): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.recordInTransaction(manager, input);
    });
  }

  private toSafeEvent(
    input: IAuthSecurityAuditInput,
  ): Partial<AuthSecurityEvent> {
    if (
      !Object.values(AuthSecurityEventType).includes(input.event_type) ||
      !Object.values(AuthSecurityEventOutcome).includes(input.outcome)
    ) {
      throw new Error('Unsupported security audit event or outcome.');
    }
    const source = input.request_source ?? AuthSecurityRequestSource.UNKNOWN;
    if (!Object.values(AuthSecurityRequestSource).includes(source)) {
      throw new Error('Unsupported security audit request source.');
    }
    return {
      event_type: input.event_type,
      outcome: input.outcome,
      request_source: source,
      actor_user_id: this.safeUuid(input.actor_user_id),
      subject_user_id: this.safeUuid(input.subject_user_id),
      session_id: this.safeUuid(input.session_id),
    };
  }

  private safeUuid(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || !UUID.test(value)) {
      throw new Error('Security audit identifier must be a UUID.');
    }
    return value;
  }
}
