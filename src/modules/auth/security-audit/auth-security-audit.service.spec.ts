import { DataSource, EntityManager } from 'typeorm';

import { AuthSecurityAuditService } from './auth-security-audit.service';
import { AuthSecurityEvent } from './auth-security-event.entity';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
  AuthSecurityRequestSource,
} from './auth-security-event.enum';

describe('AuthSecurityAuditService', () => {
  const manager = {
    queryRunner: { isTransactionActive: true },
    insert: jest.fn(),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      async (callback: (manager: EntityManager) => unknown) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const service = new AuthSecurityAuditService(dataSource);
  const event = {
    event_type: AuthSecurityEventType.SIGN_IN,
    outcome: AuthSecurityEventOutcome.DENIED,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores only allowlisted fields, never caller-supplied credential metadata', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    await service.recordInTransaction(manager, {
      ...event,
      actor_user_id: id,
      subject_user_id: null,
      session_id: id,
      request_source: AuthSecurityRequestSource.MOBILE,
      password: 'DO-NOT-STORE',
      token: 'secret',
      email: 'private@example.test',
    } as typeof event & {
      actor_user_id: string;
      subject_user_id: null;
      session_id: string;
      request_source: AuthSecurityRequestSource;
      password: string;
      token: string;
      email: string;
    });
    expect(manager.insert).toHaveBeenCalledWith(AuthSecurityEvent, {
      event_type: AuthSecurityEventType.SIGN_IN,
      outcome: AuthSecurityEventOutcome.DENIED,
      request_source: AuthSecurityRequestSource.MOBILE,
      actor_user_id: id,
      subject_user_id: null,
      session_id: id,
    });
    const persisted = JSON.stringify((manager.insert as jest.Mock).mock.calls);
    expect(persisted).not.toContain('DO-NOT-STORE');
    expect(persisted).not.toContain('private@example.test');
    expect(persisted).not.toContain('secret');
  });

  it('rejects nontransactional writes instead of silently recording outside a business transaction', async () => {
    const noTransaction = {
      queryRunner: { isTransactionActive: false },
      insert: jest.fn(),
    } as unknown as EntityManager;
    await expect(
      service.recordInTransaction(noTransaction, event),
    ).rejects.toThrow('active transaction');
    expect(noTransaction.insert).not.toHaveBeenCalled();
  });

  it('makes audit persistence errors visible to the enclosing transaction', async () => {
    (manager.insert as jest.Mock).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.recordInTransaction(manager, event)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('writes standalone attempts in an explicit database transaction', async () => {
    await service.recordAttempt(event);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenCalledTimes(1);
  });

  it('propagates failure instead of silently dropping standalone events', async () => {
    (manager.insert as jest.Mock).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.recordAttempt(event)).rejects.toThrow(
      'database unavailable',
    );
  });

  it.each([
    { ...event, event_type: 'password' },
    { ...event, outcome: 'unknown' },
    { ...event, request_source: 'password=secret' },
    { ...event, actor_user_id: 'user@example.test' },
    { ...event, subject_user_id: 'token' },
    { ...event, session_id: 'not-a-uuid' },
  ])('rejects unauthorized security audit values %#', async (input) => {
    await expect(
      service.recordInTransaction(manager, input as typeof event),
    ).rejects.toThrow();
    expect(manager.insert).not.toHaveBeenCalled();
  });
});
