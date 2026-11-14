import {
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import * as request from 'supertest';

import { AuthCapability } from '../context/auth-capability';
import { AuthContextService } from '../context/auth-context.service';
import { RequireCapabilities } from '../decorators/capabilities.decorator';

import { CapabilitiesGuard } from './capabilities.guard';

@Controller('authorization-test')
@UseGuards(CapabilitiesGuard)
class AuthorizationTestController {
  @Get('professional')
  @RequireCapabilities(AuthCapability.PROFESSIONAL_OPERATIONAL)
  professional() {
    return { ok: true };
  }

  @Get('patient')
  @RequireCapabilities(AuthCapability.PATIENT_BOOKINGS)
  patient() {
    return { ok: true };
  }

  @Get('organization')
  @RequireCapabilities(AuthCapability.ORGANIZATION_OPERATIONAL)
  organization() {
    return { ok: true };
  }
}

describe('Capability authorization denial matrix (HTTP)', () => {
  let app: INestApplication;
  const contexts = { assertCapabilities: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthorizationTestController],
      providers: [
        CapabilitiesGuard,
        { provide: AuthContextService, useValue: contexts },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request & { user?: unknown }, _res, next) => {
      req.user = {
        id: req.get('x-test-user') ?? 'user-id',
        sessionId: req.get('x-test-session') ?? 'session-id',
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['patient against professional route', '/authorization-test/professional'],
    ['pending professional', '/authorization-test/professional'],
    ['rejected professional', '/authorization-test/professional'],
    ['cross-user patient access', '/authorization-test/patient'],
  ])('returns 403 for %s', async (_caseName, path) => {
    contexts.assertCapabilities.mockRejectedValueOnce(new ForbiddenException());

    await request(app.getHttpServer()).get(path).expect(403);
    expect(contexts.assertCapabilities).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when organization A credentials select organization B', async () => {
    contexts.assertCapabilities.mockRejectedValueOnce(new ForbiddenException());

    await request(app.getHttpServer())
      .get('/authorization-test/organization')
      .set('x-organization-id', 'organization-b')
      .expect(403);
    expect(contexts.assertCapabilities).toHaveBeenCalledWith(
      'user-id',
      'session-id',
      [AuthCapability.ORGANIZATION_OPERATIONAL],
      'organization-b',
    );
  });

  it('returns 403 when organization context is omitted', async () => {
    await request(app.getHttpServer())
      .get('/authorization-test/organization')
      .expect(403);
    expect(contexts.assertCapabilities).not.toHaveBeenCalled();
  });
});
