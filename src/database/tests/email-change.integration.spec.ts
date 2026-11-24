import { randomBytes, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthChallengeDeliveryService } from '../../modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from '../../modules/auth/challenges/auth-challenge.entity';
import { AuthChallengeService } from '../../modules/auth/challenges/auth-challenge.service';
import { AuthRateLimitService } from '../../modules/auth/challenges/auth-rate-limit.service';
import { EmailChangeService } from '../../modules/auth/email-change/email-change.service';
import { EmailDestinationService } from '../../modules/auth/email-change/email-destination';
import { PasswordCredentialsService } from '../../modules/auth/password-policy/password-credentials.service';
import { AuthSecurityAuditService } from '../../modules/auth/security-audit/auth-security-audit.service';
import { TwoFactorAuthService } from '../../modules/auth/two-factor-auth.service';
import { EmailService } from '../../modules/email/email.service';
import { UserPersonaType } from '../../modules/identity/enums/user-persona-type.enum';
import { AuthChallengeFoundation1793000000000 } from '../migrations/1793000000000-AuthChallengeFoundation';
import { DurableAuthChallengeDelivery1793005000000 } from '../migrations/1793005000000-DurableAuthChallengeDelivery';
import { LeasedAuthChallengeDelivery1793006000000 } from '../migrations/1793006000000-LeasedAuthChallengeDelivery';
import { AuthChallengeWorkerHeartbeat1793007000000 } from '../migrations/1793007000000-AuthChallengeWorkerHeartbeat';
import { AuthChallengeContinuation1793700000000 } from '../migrations/1793700000000-AuthChallengeContinuation';
import { EmailChanges1795400000000 } from '../migrations/1795400000000-EmailChanges';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('verified email change on PostgreSQL', () => {
  let admin: DataSource;
  let db: DataSource;
  let schema: string;
  let service: EmailChangeService;
  let delivery: AuthChallengeDeliveryService;
  let challenges: AuthChallengeService;
  let mail: jest.Mock;
  let mfaEnabled: jest.Mock;
  let mfaVerify: jest.Mock;
  let deliveryKey: string;
  const password = 'correct-current-password';

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schema = `email_change_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    db = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      extra: { options: `-c search_path=${schema},public` },
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      synchronize: false,
    });
    await db.initialize();
    await db.query(`CREATE TABLE users (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      email varchar NOT NULL UNIQUE, password varchar NOT NULL, first_name varchar NOT NULL, last_name varchar NOT NULL,
      middle_name varchar, gender varchar, dob date, phone varchar, country varchar, image varchar,
      role text NOT NULL DEFAULT 'PATIENT', is_active boolean NOT NULL DEFAULT true, is_verified boolean NOT NULL DEFAULT true,
      account_status varchar NOT NULL DEFAULT 'active', email_verified_at timestamptz,
      verification_code varchar, verification_code_expires_at timestamptz,
      password_authentication_enabled boolean NOT NULL DEFAULT true, google_id varchar,
      reset_token varchar, reset_token_expiry timestamptz
    )`);
    await db.query(`CREATE TABLE user_personas (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      user_id uuid NOT NULL REFERENCES users(id), persona_type varchar NOT NULL, is_active boolean NOT NULL DEFAULT true
    )`);
    await db.query(`CREATE TABLE auth_sessions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      session_id varchar NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id), refresh_token_hash varchar NOT NULL,
      credential_version smallint NOT NULL DEFAULT 2, last_used_at timestamptz, expires_at timestamptz NOT NULL, revoked_at timestamptz
    )`);
    await db.query(`CREATE TABLE auth_security_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), event_type varchar NOT NULL,
      outcome varchar NOT NULL, actor_user_id uuid, subject_user_id uuid, session_id uuid,
      request_source varchar NOT NULL DEFAULT 'unknown', occurred_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_auth_security_events_type" CHECK (event_type IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link', 'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration', 'mfa', 'mfa_enrollment_started', 'mfa_activated', 'mfa_recovery_codes_regenerated', 'mfa_disabled', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification', 'context_restoration', 'authorization_denial'))
    )`);
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await new AuthChallengeFoundation1793000000000().up(runner);
      await new DurableAuthChallengeDelivery1793005000000().up(runner);
      await new LeasedAuthChallengeDelivery1793006000000().up(runner);
      await new AuthChallengeWorkerHeartbeat1793007000000().up(runner);
      await new AuthChallengeContinuation1793700000000().up(runner);
      await runner.query(
        'ALTER TABLE auth_challenges ADD COLUMN continuation_transport varchar',
      );
      await runner.query(
        'ALTER TABLE auth_challenges DROP CONSTRAINT "CHK_auth_challenge_purpose"',
      );
      await runner.query(
        `ALTER TABLE auth_challenges ADD CONSTRAINT "CHK_auth_challenge_purpose" CHECK (purpose IN ('contact_verification', 'password_recovery', 'login_verification', 'mfa_login'))`,
      );
      await new EmailChanges1795400000000().up(runner);
    } finally {
      await runner.release();
    }
    await db.query(
      `INSERT INTO auth_challenge_worker_heartbeat (id, last_seen_at, pending, oldest_pending_seconds, expired_leases) VALUES ('delivery', now(), 0, 0, 0)`,
    );
    deliveryKey = randomBytes(32).toString('base64');
    const settings = {
      get: (name: string) => {
        if (name === 'AUTH_CHALLENGE_PEPPER')
          return 'email-change-test-pepper-with-at-least-32-bytes';
        if (name === 'AUTH_CHALLENGE_DELIVERY_KEY') return deliveryKey;
        if (name === 'AUTH_CHALLENGE_FLOWS_ENABLED') return 'true';
        if (name === 'auth.recoveryContinuationUrl')
          return 'https://app.example.test/reset-password';
        if (name === 'mail.from.address') return 'no-reply@example.test';
        if (name === 'app.name') return 'OHealth';
        return undefined;
      },
    } as ConfigService;
    const audit = new AuthSecurityAuditService(db);
    challenges = new AuthChallengeService(db, settings);
    mail = jest.fn().mockResolvedValue(undefined);
    mfaEnabled = jest.fn().mockResolvedValue(false);
    mfaVerify = jest.fn().mockResolvedValue(false);
    const destinations = new EmailDestinationService(settings);
    delivery = new AuthChallengeDeliveryService(
      db,
      settings,
      challenges,
      { sendMail: mail } as unknown as EmailService,
      audit,
      destinations,
    );
    service = new EmailChangeService(
      db,
      new AccountAccessPolicyService(),
      {
        verify: jest.fn(async (candidate: string) => candidate === password),
      } as unknown as PasswordCredentialsService,
      {
        isEnabled: mfaEnabled,
        verifyForLogin: mfaVerify,
      } as unknown as TwoFactorAuthService,
      challenges,
      delivery,
      destinations,
      new AuthRateLimitService(db, settings),
      audit,
    );
  });

  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized && schema)
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  });
  afterAll(async () => {
    if (admin?.isInitialized) await admin.destroy();
  });

  async function account(
    persona: UserPersonaType,
    email = `${randomUUID()}@example.test`,
    status = 'active',
  ) {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const otherSessionId = randomUUID();
    await db.query(
      'INSERT INTO users (id, email, password, first_name, last_name, account_status, email_verified_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
      [userId, email, 'hash', 'Ada', 'Okafor', status],
    );
    await db.query(
      'INSERT INTO user_personas (user_id, persona_type) VALUES ($1,$2)',
      [userId, persona],
    );
    for (const id of [sessionId, otherSessionId])
      await db.query(
        "INSERT INTO auth_sessions (session_id, user_id, refresh_token_hash, expires_at) VALUES ($1,$2,$3,now() + interval '1 day')",
        [id, userId, randomUUID()],
      );
    return { userId, sessionId, otherSessionId, email };
  }

  async function codeFor(): Promise<string> {
    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    expect(mail).toHaveBeenCalledTimes(1);
    const sent = mail.mock.calls[0][0] as { templateData: { code: string } };
    return sent.templateData.code;
  }

  for (const persona of [
    UserPersonaType.PATIENT,
    UserPersonaType.HEALTHCARE_PROFESSIONAL,
  ]) {
    it(`commits proof for ${persona}, revokes all sessions and keeps audit private`, async () => {
      const owner = await account(persona);
      const candidate = 'NEW@EXAMPLE.TEST';
      const issued = await service.begin(owner.userId, owner.sessionId, {
        candidate_email: candidate,
        current_password: password,
      });
      expect(
        (
          await db.query('SELECT email FROM users WHERE id = $1', [
            owner.userId,
          ])
        )[0].email,
      ).toBe(owner.email);
      const pending = (await db.query('SELECT * FROM auth_email_changes'))[0];
      expect(JSON.stringify(pending)).not.toContain(candidate.toLowerCase());
      const code = await codeFor();
      expect(mail.mock.calls[0][0].to).toEqual([
        { email: 'new@example.test', name: 'Ada' },
      ]);
      expect(
        await service.confirm(
          owner.userId,
          owner.sessionId,
          issued.challenge_id,
          code,
        ),
      ).toEqual({ sessions_revoked: true });
      expect(
        (
          await db.query('SELECT email FROM users WHERE id = $1', [
            owner.userId,
          ])
        )[0].email,
      ).toBe('new@example.test');
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL',
            [owner.userId],
          )
        )[0].n,
      ).toBe(0);
      expect(await db.query('SELECT * FROM auth_email_changes')).toHaveLength(
        0,
      );
      const events = await db.query(
        'SELECT * FROM auth_security_events WHERE event_type = $1',
        ['email_change'],
      );
      expect(events).toHaveLength(1);
      expect(events[0].outcome).toBe('succeeded');
      expect(JSON.stringify(events)).not.toContain(owner.email);
      expect(JSON.stringify(events)).not.toContain('new@example.test');
      expect(JSON.stringify(events)).not.toContain(code);
      await expect(
        service.confirm(
          owner.userId,
          owner.sessionId,
          issued.challenge_id,
          code,
        ),
      ).rejects.toBeDefined();
    });
  }

  it('uses an undeliverable challenge for an owned address and keeps resend behavior', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    await account(
      UserPersonaType.HEALTHCARE_PROFESSIONAL,
      'taken@example.test',
    );
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'TAKEN@EXAMPLE.TEST',
      current_password: password,
    });
    expect(
      (await db.query('SELECT deliverable FROM auth_email_changes'))[0]
        .deliverable,
    ).toBe(false);
    expect(
      await db.query('SELECT * FROM auth_challenge_deliveries'),
    ).toHaveLength(0);
    await db.query(
      `UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' WHERE id = $1`,
      [issued.challenge_id],
    );
    const replacement = await service.resend(
      owner.userId,
      owner.sessionId,
      issued.challenge_id,
    );
    expect(replacement.challenge_id).not.toBe(issued.challenge_id);
    expect(
      await db.query('SELECT * FROM auth_challenge_deliveries'),
    ).toHaveLength(0);
    await expect(
      service.confirm(
        owner.userId,
        owner.sessionId,
        replacement.challenge_id,
        '000000',
      ),
    ).rejects.toBeDefined();
    expect(
      (
        await db.query('SELECT email FROM users WHERE id = $1', [owner.userId])
      )[0].email,
    ).toBe(owner.email);
  });

  it('resends to the candidate and supersedes the old challenge', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'resend@example.test',
      current_password: password,
    });
    await db.query(
      `UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' WHERE id = $1`,
      [issued.challenge_id],
    );
    const replacement = await service.resend(
      owner.userId,
      owner.sessionId,
      issued.challenge_id,
    );
    expect(replacement.challenge_id).not.toBe(issued.challenge_id);
    expect(await delivery.dispatchBatch(2)).toMatchObject({
      accepted: 1,
      discarded: 1,
    });
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0][0].to).toEqual([
      { email: 'resend@example.test', name: 'Ada' },
    ]);
    const code = mail.mock.calls[0][0].templateData.code as string;
    await expect(
      service.confirm(owner.userId, owner.sessionId, issued.challenge_id, code),
    ).rejects.toBeDefined();
    expect(
      await service.confirm(
        owner.userId,
        owner.sessionId,
        replacement.challenge_id,
        code,
      ),
    ).toEqual({ sessions_revoked: true });
  });

  it('allows exactly one concurrent confirmation for one challenge', async () => {
    const owner = await account(UserPersonaType.HEALTHCARE_PROFESSIONAL);
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'single@example.test',
      current_password: password,
    });
    const code = await codeFor();
    const outcomes = await Promise.allSettled([
      service.confirm(owner.userId, owner.sessionId, issued.challenge_id, code),
      service.confirm(owner.userId, owner.sessionId, issued.challenge_id, code),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM auth_security_events WHERE event_type = $1 AND outcome = $2',
          ['email_change', 'succeeded'],
        )
      )[0].n,
    ).toBe(1);
  });

  for (const purpose of [
    AuthChallengePurpose.LOGIN_VERIFICATION,
    AuthChallengePurpose.MFA_LOGIN,
    AuthChallengePurpose.PASSWORD_RECOVERY,
  ]) {
    it(`revokes a pending ${purpose} proof when the email commits`, async () => {
      const owner = await account(UserPersonaType.PATIENT);
      const oldProof = await challenges.issueForUser(owner.userId, purpose);
      const issued = await service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'new-proof@example.test',
        current_password: password,
      });
      const code = await codeFor();
      await service.confirm(
        owner.userId,
        owner.sessionId,
        issued.challenge_id,
        code,
      );
      expect(
        (
          await db.query(
            'SELECT terminal_reason FROM auth_challenges WHERE id = $1',
            [oldProof.challengeId],
          )
        )[0].terminal_reason,
      ).toBe('administratively_revoked');
      await expect(
        challenges.consumeWithMutation(
          oldProof.challengeId,
          purpose,
          oldProof.code,
          async () => true,
        ),
      ).rejects.toBeDefined();
    });
  }

  it('fails closed when the delivery worker is unavailable', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    await db.query(
      `UPDATE auth_challenge_worker_heartbeat SET last_seen_at = now() - interval '1 minute'`,
    );
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'unavailable@example.test',
        current_password: password,
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(await db.query('SELECT * FROM auth_email_changes')).toHaveLength(0);
    expect(
      (
        await db.query('SELECT email FROM users WHERE id = $1', [owner.userId])
      )[0].email,
    ).toBe(owner.email);
  });

  it('maps an invalid delivery key to the canonical 503 before hashing the candidate', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    deliveryKey = 'invalid';
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'new@example.test',
        current_password: password,
      }),
    ).rejects.toMatchObject({
      status: 503,
      response: { error_code: 'AUTH_SERVICE_TEMPORARILY_UNAVAILABLE' },
    });
  });

  it('rejects wrong purpose, exhausted codes and ineligible state', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    const wrongPurpose = await challenges.issueForUser(
      owner.userId,
      AuthChallengePurpose.PASSWORD_RECOVERY,
    );
    await expect(
      service.confirm(
        owner.userId,
        owner.sessionId,
        wrongPurpose.challengeId,
        wrongPurpose.code,
      ),
    ).rejects.toBeDefined();
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'candidate@example.test',
      current_password: password,
    });
    const validCode = await codeFor();
    const invalidCode = validCode === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++)
      await expect(
        service.confirm(
          owner.userId,
          owner.sessionId,
          issued.challenge_id,
          invalidCode,
        ),
      ).rejects.toBeDefined();
    expect(
      (
        await db.query(
          'SELECT terminal_reason FROM auth_challenges WHERE id = $1',
          [issued.challenge_id],
        )
      )[0].terminal_reason,
    ).toBe('attempts_exhausted');
    await db.query(
      `UPDATE users SET account_status = 'suspended' WHERE id = $1`,
      [owner.userId],
    );
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'other@example.test',
        current_password: password,
      }),
    ).rejects.toBeDefined();
  });

  it('requires current credentials and an active patient or professional persona', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'next@example.test',
        current_password: 'wrong',
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: { error_code: 'EMAIL_CHANGE_REAUTHENTICATION_REQUIRED' },
    });
    expect(await db.query('SELECT * FROM auth_email_changes')).toHaveLength(0);
    await db.query(
      'UPDATE user_personas SET is_active = false WHERE user_id = $1',
      [owner.userId],
    );
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'next@example.test',
        current_password: password,
      }),
    ).rejects.toBeDefined();
    expect(await db.query('SELECT * FROM auth_email_changes')).toHaveLength(0);
  });

  it('requires a recent original session for an OAuth-only account', async () => {
    const owner = await account(UserPersonaType.HEALTHCARE_PROFESSIONAL);
    await db.query(
      'UPDATE users SET password_authentication_enabled = false WHERE id = $1',
      [owner.userId],
    );
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'oauth-next@example.test',
    });
    expect(issued.challenge_id).toBeDefined();
    await db.query(
      `UPDATE auth_sessions SET created_at = now() - interval '11 minutes' WHERE session_id = $1`,
      [owner.sessionId],
    );
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'oauth-later@example.test',
      }),
    ).rejects.toBeDefined();
  });

  it('requires current MFA proof when the factor is enabled', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    mfaEnabled.mockResolvedValue(true);
    await expect(
      service.begin(owner.userId, owner.sessionId, {
        candidate_email: 'mfa-next@example.test',
        current_password: password,
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: { error_code: 'EMAIL_CHANGE_MFA_REQUIRED' },
    });
    expect(await db.query('SELECT * FROM auth_email_changes')).toHaveLength(0);
    mfaVerify.mockResolvedValue(true);
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'mfa-next@example.test',
      current_password: password,
      mfa_code: '123456',
    });
    expect(issued.challenge_id).toBeDefined();
    expect(mfaVerify).toHaveBeenCalledWith(
      expect.anything(),
      owner.userId,
      '123456',
    );
  });

  it('rejects another signed-in account even with the correct proof', async () => {
    const owner = await account(UserPersonaType.PATIENT);
    const other = await account(UserPersonaType.HEALTHCARE_PROFESSIONAL);
    const issued = await service.begin(owner.userId, owner.sessionId, {
      candidate_email: 'private@example.test',
      current_password: password,
    });
    const code = await codeFor();
    await expect(
      service.confirm(other.userId, other.sessionId, issued.challenge_id, code),
    ).rejects.toBeDefined();
    expect(
      (
        await db.query('SELECT email FROM users WHERE id = $1', [owner.userId])
      )[0].email,
    ).toBe(owner.email);
    expect(
      await service.confirm(
        owner.userId,
        owner.sessionId,
        issued.challenge_id,
        code,
      ),
    ).toEqual({ sessions_revoked: true });
  });

  it('allows only one concurrent commit to a candidate address', async () => {
    const a = await account(UserPersonaType.PATIENT);
    const b = await account(UserPersonaType.HEALTHCARE_PROFESSIONAL);
    const candidate = 'shared@example.test';
    const first = await service.begin(a.userId, a.sessionId, {
      candidate_email: candidate,
      current_password: password,
    });
    const second = await service.begin(b.userId, b.sessionId, {
      candidate_email: candidate,
      current_password: password,
    });
    const codeA = await codeFor();
    mail.mockClear();
    const codeB = await codeFor();
    const outcomes = await Promise.allSettled([
      service.confirm(a.userId, a.sessionId, first.challenge_id, codeA),
      service.confirm(b.userId, b.sessionId, second.challenge_id, codeB),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM users WHERE email = $1',
          [candidate],
        )
      )[0].n,
    ).toBe(1);
  });
});
