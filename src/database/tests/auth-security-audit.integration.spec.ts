import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { AuthSecurityAuditService } from '../../modules/auth/security-audit/auth-security-audit.service';
import { AuthSecurityEvent } from '../../modules/auth/security-audit/auth-security-event.entity';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
  AuthSecurityRequestSource,
} from '../../modules/auth/security-audit/auth-security-event.enum';
import { AuthSecurityAuditFoundation1792900000000 } from '../migrations/1792900000000-AuthSecurityAuditFoundation';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Authentication audit foundation on PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;
  let service: AuthSecurityAuditService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      entities: [AuthSecurityEvent],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    service = new AuthSecurityAuditService(dataSource);
  });

  beforeEach(async () => {
    schemaName = 'auth_audit_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    await runner.startTransaction();
    await new AuthSecurityAuditFoundation1792900000000().up(runner);
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schemaName) {
      await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('stores a typed event without sensitive metadata or user dependencies', async () => {
    const userId = randomUUID();
    await service.recordInTransaction(runner.manager, {
      event_type: AuthSecurityEventType.SIGN_IN,
      outcome: AuthSecurityEventOutcome.DENIED,
      subject_user_id: userId,
      request_source: AuthSecurityRequestSource.WEB,
    });
    const rows: Array<Record<string, unknown>> = await runner.query(
      'SELECT * FROM auth_security_events',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event_type: 'sign_in',
      outcome: 'denied',
      subject_user_id: userId,
      actor_user_id: null,
      session_id: null,
      request_source: 'web',
    });
    expect(rows[0].occurred_at).toBeInstanceOf(Date);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'id',
        'event_type',
        'outcome',
        'actor_user_id',
        'subject_user_id',
        'session_id',
        'request_source',
        'occurred_at',
      ].sort(),
    );
  });

  it('rolls back an audit row together with an aborted security mutation', async () => {
    await runner.query('CREATE TABLE protected_state (id uuid PRIMARY KEY)');
    await runner.query('SAVEPOINT security_operation');
    await runner.query('INSERT INTO protected_state (id) VALUES ($1)', [
      randomUUID(),
    ]);
    await service.recordInTransaction(runner.manager, {
      event_type: AuthSecurityEventType.ACCOUNT_STATE_CHANGE,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
    });
    await runner.query('ROLLBACK TO SAVEPOINT security_operation');
    const state: Array<{ count: string }> = await runner.query(
      'SELECT count(*) FROM protected_state',
    );
    const audits: Array<{ count: string }> = await runner.query(
      'SELECT count(*) FROM auth_security_events',
    );
    expect(state[0].count).toBe('0');
    expect(audits[0].count).toBe('0');
  });

  it('enforces database event, outcome and source allowlists', async () => {
    for (const testCase of [
      {
        values: ['plaintext_password', 'denied', 'api'],
        constraint: 'CHK_auth_security_events_type',
      },
      {
        values: ['sign_in', 'secret', 'api'],
        constraint: 'CHK_auth_security_events_outcome',
      },
      {
        values: ['sign_in', 'denied', 'raw-query'],
        constraint: 'CHK_auth_security_events_source',
      },
    ]) {
      await runner.query('SAVEPOINT invalid_event');
      await expect(
        runner.query(
          `INSERT INTO auth_security_events ("event_type", "outcome", "request_source")
           VALUES ($1, $2, $3)`,
          testCase.values,
        ),
      ).rejects.toThrow(testCase.constraint);
      await runner.query('ROLLBACK TO SAVEPOINT invalid_event');
    }
    const rows: Array<{ count: string }> = await runner.query(
      'SELECT count(*) FROM auth_security_events',
    );
    expect(rows[0].count).toBe('0');
  });

  it('rejects update, delete, and truncate attempts against audit evidence', async () => {
    await service.recordInTransaction(runner.manager, {
      event_type: AuthSecurityEventType.SIGN_IN,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
    });
    for (const statement of [
      "UPDATE auth_security_events SET outcome = 'denied'",
      'DELETE FROM auth_security_events',
      'TRUNCATE auth_security_events',
    ]) {
      await runner.query('SAVEPOINT immutable_audit');
      await expect(runner.query(statement)).rejects.toThrow(
        'Authentication security audit events are immutable',
      );
      await runner.query('ROLLBACK TO SAVEPOINT immutable_audit');
    }
    const rows: Array<{ outcome: string }> = await runner.query(
      'SELECT outcome FROM auth_security_events',
    );
    expect(rows).toEqual([{ outcome: 'succeeded' }]);
  });

  it('persists audit history across committed transactions and connections', async () => {
    await service.recordInTransaction(runner.manager, {
      event_type: AuthSecurityEventType.LOGOUT,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
      session_id: randomUUID(),
    });
    await runner.commitTransaction();

    const independentRunner = dataSource.createQueryRunner();
    await independentRunner.connect();
    try {
      await independentRunner.query(
        `SET search_path TO "${schemaName}", public`,
      );
      const rows: Array<{ event_type: string }> = await independentRunner.query(
        'SELECT event_type FROM auth_security_events',
      );
      expect(rows).toEqual([{ event_type: 'logout' }]);
    } finally {
      await independentRunner.release();
    }
  });

  it('commits a standalone attempt with a real DataSource transaction', async () => {
    await runner.commitTransaction();
    const standaloneSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      schema: schemaName,
      entities: [AuthSecurityEvent],
      synchronize: false,
    });
    await standaloneSource.initialize();
    try {
      await new AuthSecurityAuditService(standaloneSource).recordAttempt({
        event_type: AuthSecurityEventType.SIGN_IN,
        outcome: AuthSecurityEventOutcome.DENIED,
        request_source: AuthSecurityRequestSource.API,
      });
      const rows: Array<{ event_type: string; outcome: string }> =
        await standaloneSource.query(
          `SELECT event_type, outcome FROM "${schemaName}"."auth_security_events"`,
        );
      expect(rows).toEqual([{ event_type: 'sign_in', outcome: 'denied' }]);
    } finally {
      await standaloneSource.destroy();
    }
  });
});
