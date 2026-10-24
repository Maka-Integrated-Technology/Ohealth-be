import { QueryRunner } from 'typeorm';

import { CanonicalAccountLifecycle1792750000000 } from '../migrations/1792750000000-CanonicalAccountLifecycle';

describe('Canonical account lifecycle migration', () => {
  it('preserves a separate baseline and validates both migrated flags and status', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CanonicalAccountLifecycle1792750000000();
    await migration.up({ query } as unknown as QueryRunner);
    const statements = query.mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(statements).toContain('Unsupported account_status');
    expect(statements).toContain(
      "WHEN \"account_status\" IN ('suspended', 'deactivated')",
    );
    expect(statements).toContain('email_verified_at');
    expect(statements).toContain('CHK_users_canonical_account_access');
    expect(statements).toContain('user_account_status_history');
    expect(statements).toContain('account_status_before_migration');
    expect(query).toHaveBeenCalled();
  });

  it('refuses an unsafe automatic rollback of verified contact timestamps', async () => {
    await expect(
      new CanonicalAccountLifecycle1792750000000().down({} as QueryRunner),
    ).rejects.toThrow('cannot be safely reversed');
  });
});
