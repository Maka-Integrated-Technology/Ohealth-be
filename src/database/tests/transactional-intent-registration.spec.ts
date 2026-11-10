import { QueryRunner } from 'typeorm';

import { TransactionalIntentRegistration1793600000000 } from '../migrations/1793600000000-TransactionalIntentRegistration';

describe('TransactionalIntentRegistration migration', () => {
  it('adds normalized uniqueness and HMAC-only retry receipts', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new TransactionalIntentRegistration1793600000000().up({
      query,
    } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('Duplicate normalized user emails');
    expect(sql).toContain('UQ_users_email_normalized');
    expect(sql).toContain('UQ_organizations_registration_normalized');
    expect(sql).toContain('CREATE TABLE "registration_attempts"');
    expect(sql).not.toContain('idempotency_key');
  });

  it('rolls back only the additive registration objects in dependency order', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new TransactionalIntentRegistration1793600000000().down({
      query,
    } as unknown as QueryRunner);
    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE "registration_attempts"',
      'DROP INDEX "UQ_organizations_registration_normalized"',
      'DROP INDEX "UQ_users_email_normalized"',
    ]);
  });
});
