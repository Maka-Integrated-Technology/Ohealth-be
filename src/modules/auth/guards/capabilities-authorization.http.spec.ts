/* eslint-disable jest/expect-expect -- Supertest status assertions exercise the HTTP boundary. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import * as request from 'supertest';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { OrganizationDocumentsService } from '../../organization/organization-documents.service';
import { OrganizationOnboardingService } from '../../organization/organization-onboarding.service';
import { OrganizationVerificationService } from '../../organization/organization-verification.service';
import { OrganizationController } from '../../organization/organization.controller';
import { ProfessionalVerificationStatus } from '../../professional/entities/professional.entity';
import { ProfessionalController } from '../../professional/professional.controller';
import { ProfessionalService } from '../../professional/professional.service';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AuthContextService } from '../context/auth-context.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';

import { CapabilitiesGuard } from './capabilities.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('Protected controller authorization with current account context (HTTP)', () => {
  let app: INestApplication;
  const account = {
    id: 'user-id',
    email: 'person@example.test',
    first_name: 'Person',
    last_name: 'User',
    role: [],
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
  const persona = { persona_type: UserPersonaType.PATIENT, is_active: true };
  const professional = {
    verification_status: ProfessionalVerificationStatus.PENDING,
    profile_setup_completed: true,
    is_active: true,
  };
  const membership = {
    organization_id: 'organization-a',
    user_id: 'user-id',
    role: OrganizationMembershipRole.OWNER,
    status: OrganizationMembershipStatus.ACTIVE,
    permission_overrides: [],
    organization: {
      id: 'organization-a',
      organization_type: OrganizationType.LABORATORY,
      name: 'Laboratory A',
      verification_status: OrganizationVerificationStatus.PENDING,
      is_active: true,
    },
  };
  const session = {
    session_id: 'session-id',
    expires_at: new Date(Date.now() + 60_000),
    revoked_at: null,
    last_used_at: null,
  };
  const users = { findOne: jest.fn() };
  const personas = { find: jest.fn() };
  const professionals = { findOne: jest.fn() };
  const memberships = { find: jest.fn() };
  const sessions = { findOne: jest.fn() };
  const privileges = { find: jest.fn() };
  const verification = { getMine: jest.fn().mockResolvedValue({ ok: true }) };
  const professionalService = {
    getDashboard: jest.fn().mockResolvedValue({ ok: true }),
  };

  beforeAll(async () => {
    const contexts = new AuthContextService(
      users as never,
      personas as never,
      professionals as never,
      memberships as never,
      sessions as never,
      privileges as never,
      {
        findOne: jest.fn().mockResolvedValue({
          twoFaEnabled: true,
          encryptedSecret: 'encrypted',
        }),
      } as never,
      { get: jest.fn() } as never,
    );
    const module = await Test.createTestingModule({
      controllers: [OrganizationController, ProfessionalController],
      providers: [
        CapabilitiesGuard,
        { provide: AuthContextService, useValue: contexts },
        {
          provide: AuthSecurityAuditService,
          useValue: { recordAttempt: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: OrganizationOnboardingService, useValue: {} },
        { provide: OrganizationDocumentsService, useValue: {} },
        { provide: OrganizationVerificationService, useValue: verification },
        { provide: ProfessionalService, useValue: professionalService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use((req: Request & { user?: unknown }, _res, next) => {
      req.user = {
        id: req.get('x-test-user') ?? 'user-id',
        sessionId: 'session-id',
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    account.account_status = AccountStatus.ACTIVE;
    account.email_verified_at = new Date();
    persona.persona_type = UserPersonaType.PATIENT;
    professional.verification_status = ProfessionalVerificationStatus.PENDING;
    membership.status = OrganizationMembershipStatus.ACTIVE;
    membership.role = OrganizationMembershipRole.OWNER;
    membership.organization.verification_status =
      OrganizationVerificationStatus.PENDING;
    session.expires_at = new Date(Date.now() + 60_000);
    users.findOne.mockResolvedValue(account);
    personas.find.mockResolvedValue([persona]);
    professionals.findOne.mockResolvedValue(null);
    memberships.find.mockImplementation(async ({ where }) =>
      where.user_id === membership.user_id ? [membership] : [],
    );
    sessions.findOne.mockResolvedValue(session);
    privileges.find.mockResolvedValue([]);
  });

  it('denies a patient on the real professional dashboard route', async () => {
    await request(app.getHttpServer())
      .get('/professionals/me/dashboard')
      .expect(403);
    expect(professionalService.getDashboard).not.toHaveBeenCalled();
  });

  it.each([
    ProfessionalVerificationStatus.PENDING,
    ProfessionalVerificationStatus.REJECTED,
  ])('denies a %s professional on the dashboard route', async (status) => {
    persona.persona_type = UserPersonaType.HEALTHCARE_PROFESSIONAL;
    professionals.findOne.mockResolvedValue({
      ...professional,
      verification_status: status,
    });
    await request(app.getHttpServer())
      .get('/professionals/me/dashboard')
      .expect(403);
  });

  it('denies organization B even while organization A membership is active', async () => {
    await request(app.getHttpServer())
      .get('/organizations/onboarding/me/status')
      .set('x-organization-id', 'organization-b')
      .expect(403);
    expect(verification.getMine).not.toHaveBeenCalled();
  });

  it('denies a suspended membership immediately', async () => {
    membership.status = OrganizationMembershipStatus.SUSPENDED;
    await request(app.getHttpServer())
      .get('/organizations/onboarding/me/status')
      .set('x-organization-id', 'organization-a')
      .expect(403);
  });

  it('denies a different account with no current membership', async () => {
    users.findOne.mockResolvedValue({ ...account, id: 'other-user-id' });
    await request(app.getHttpServer())
      .get('/organizations/onboarding/me/status')
      .set('x-test-user', 'other-user-id')
      .set('x-organization-id', 'organization-a')
      .expect(403);
  });

  it('denies revoked and expired sessions from current state', async () => {
    sessions.findOne.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/organizations/onboarding/me/status')
      .set('x-organization-id', 'organization-a')
      .expect(404);
    sessions.findOne.mockResolvedValue({ ...session, expires_at: new Date(0) });
    await request(app.getHttpServer())
      .get('/organizations/onboarding/me/status')
      .set('x-organization-id', 'organization-a')
      .expect(404);
  });

  it('denies a suspended account from current state', async () => {
    users.findOne.mockResolvedValue({
      ...account,
      account_status: AccountStatus.SUSPENDED,
    });
    await request(app.getHttpServer())
      .get('/organizations/onboarding/me/status')
      .set('x-organization-id', 'organization-a')
      .expect(403);
  });
});
