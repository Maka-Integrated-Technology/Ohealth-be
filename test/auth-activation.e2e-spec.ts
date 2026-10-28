import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AccountAccessPolicyService } from '../src/modules/auth/account-access-policy.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthRateLimitService } from '../src/modules/auth/challenges/auth-rate-limit.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { AccountStatus } from '../src/modules/user/enums/account-status.enum';
import { UserRole } from '../src/modules/user/enums/user-role.enum';
import { UserService } from '../src/modules/user/user.service';

describe('Retired account activation (isolated e2e)', () => {
  const secret = 'fixed-test-secret-for-legacy-activation';
  const userId = 'test-user-id';
  const url = `/api/auth/users/${userId}/activate`;
  let app: INestApplication;
  let jwtService: JwtService;
  const save = jest.fn();
  const findById = jest.fn();

  beforeAll(async () => {
    findById.mockResolvedValue({
      id: userId,
      email: 'verified@example.com',
      role: [UserRole.PATIENT],
      is_active: true,
      is_verified: true,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
      ],
      controllers: [AuthController],
      providers: [
        JwtAuthGuard,
        JwtStrategy,
        { provide: AuthAbuseGuard, useValue: { canActivate: () => true } },
        {
          provide: AuthRateLimitService,
          useValue: {
            consume: jest.fn().mockResolvedValue({
              allowed: true,
              hits: 1,
              retryAfterSeconds: 0,
            }),
          },
        },
        AccountAccessPolicyService,
        { provide: AuthService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'AUTH_TRUSTED_PROXY_CIDRS' ? '' : secret,
          },
        },
        { provide: UserService, useValue: { findById, save } },
      ],
    }).compile();

    jwtService = moduleFixture.get(JwtService);
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    save.mockClear();
    findById.mockClear();
  });

  it('rejects anonymous account activation with 401', async () => {
    await request(app.getHttpServer()).patch(url).expect(401);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects invalid authentication with 401', async () => {
    await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an authenticated user with 403 without activating an account', async () => {
    const token = jwtService.sign({
      sub: userId,
      email: 'verified@example.com',
      role: [UserRole.PATIENT],
    });
    await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(findById).toHaveBeenCalledWith(userId);
    expect(save).not.toHaveBeenCalled();
  });
});
