import { Get, INestApplication, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as request from 'supertest';

import { GlobalExceptionFilter } from '../src/common/exceptions/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AuthChallengeValidationPipe } from '../src/modules/auth/challenges/auth-challenge-validation.pipe';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { RefreshSessionService } from '../src/modules/auth/sessions/refresh-session.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { ProfessionalController } from '../src/modules/professional/professional.controller';
import { ProfessionalService } from '../src/modules/professional/professional.service';
import {
  PublicDateRangeQueryDto,
  PublicProfessionalDirectoryQueryDto,
} from '../src/modules/public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryController } from '../src/modules/public-discovery/public-discovery.controller';
import { PublicDiscoveryRoutes } from '../src/modules/public-discovery/public-discovery.decorators';
import { PublicResourceNotFoundException } from '../src/modules/public-discovery/public-discovery.errors';
import { PublicDiscoveryService } from '../src/modules/public-discovery/public-discovery.service';
import { PublicResourceIdPipe } from '../src/modules/public-discovery/public-resource-id.pipe';
import { SpecialityController } from '../src/modules/speciality/speciality.controller';
import { SpecialityService } from '../src/modules/speciality/speciality.service';

const VISIBLE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const HIDDEN_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

/** Stands in for the discovery endpoints that later build on this boundary. */
@PublicDiscoveryRoutes('probe')
class PublicDiscoveryProbeController {
  @Get()
  list(@Query() query: PublicProfessionalDirectoryQueryDto) {
    return query;
  }

  @Get('range')
  range(@Query() query: PublicDateRangeQueryDto) {
    return query;
  }

  @Get(':id')
  findOne(@Param('id', PublicResourceIdPipe) id: string) {
    if (id !== VISIBLE_ID) throw new PublicResourceNotFoundException();
    return { id };
  }
}

/** Isolated HTTP boundary test: no database, accounts, or external services. */
describe('Public discovery boundary (#141)', () => {
  let app: INestApplication;
  const specialityService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const professionalService = {
    findBySpeciality: jest.fn(),
    findById: jest.fn(),
    findMe: jest.fn(),
    create: jest.fn(),
  };
  const validateSession = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: 'public-discovery-boundary-test-secret' }),
      ],
      controllers: [
        PublicDiscoveryController,
        PublicDiscoveryProbeController,
        SpecialityController,
        ProfessionalController,
      ],
      providers: [
        PublicDiscoveryService,
        PublicResourceIdPipe,
        JwtStrategy,
        RolesGuard,
        { provide: SpecialityService, useValue: specialityService },
        { provide: ProfessionalService, useValue: professionalService },
        {
          provide: RefreshSessionService,
          useValue: { validate: validateSession },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'TOKEN_ACCESS_DURATION') return '15m';
              if (key === 'TOKEN_REFRESH_DURATION') return '7d';
              return 'public-discovery-boundary-test-secret';
            },
          },
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        // Same deny-by-default wiring as the application module.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new AuthChallengeValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => app?.close());

  beforeEach(() => jest.clearAllMocks());

  const server = () => request(app.getHttpServer());
  const stripVolatile = (body: Record<string, unknown>) => {
    const { timestamp: _timestamp, path: _path, stack: _stack, ...rest } = body;
    return rest;
  };

  describe('public routes', () => {
    it('serves the discovery contract without credentials', async () => {
      const result = await server()
        .get('/api/public/discovery/contract')
        .expect(200);

      expect(result.body).toEqual({
        status_code: 200,
        message: null,
        data: {
          pagination: { default_limit: 20, max_limit: 50, max_page: 1000 },
          search: { min_length: 2, max_length: 100 },
          professional_sort: {
            fields: ['rating', 'experience', 'consultation_fee', 'name'],
            orders: ['asc', 'desc'],
            default_field: 'rating',
            default_order: 'desc',
          },
          consultation_types: ['chat', 'video', 'both'],
          max_availability_range_days: 31,
        },
      });
      expect(result.headers['cache-control']).toBe('public, max-age=300');
      expect(result.headers['set-cookie']).toBeUndefined();
    });

    it('ignores supplied credentials instead of evaluating them', async () => {
      await server()
        .get('/api/public/discovery/contract')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(200);

      expect(validateSession).not.toHaveBeenCalled();
    });

    it.each(['post', 'put', 'patch', 'delete'] as const)(
      'exposes no %s operation in the public namespace',
      async (method) => {
        await server()[method]('/api/public/discovery/contract').expect(404);
      },
    );

    it('normalizes and defaults shared query parameters', async () => {
      const result = await server()
        .get('/api/public/probe')
        .query({ q: '  heart   care ', limit: '5' })
        .expect(200);

      expect(result.body.data).toEqual({
        page: 1,
        limit: 5,
        q: 'heart care',
        sort: 'rating',
        order: 'desc',
      });
    });

    it('rejects out-of-contract queries with deterministic errors', async () => {
      const result = await server()
        .get('/api/public/probe')
        .query({ limit: '500', sort: 'license_number', role: 'admin' })
        .expect(400);

      expect(result.body).toMatchObject({
        status_code: 400,
        error: 'Bad Request',
        data: null,
        message: [
          'property role should not exist',
          'sort must be one of: rating, experience, consultation_fee, name',
          'limit must be an integer between 1 and 50',
        ],
      });
    });

    it('rejects an unbounded date range', async () => {
      const result = await server()
        .get('/api/public/probe/range')
        .query({ from: '2026-01-01', to: '2026-12-31' })
        .expect(400);

      expect(result.body.message).toEqual([
        'to must be on or after from and cover at most 31 days',
      ]);
    });

    it('returns a visible resource', async () => {
      const result = await server()
        .get(`/api/public/probe/${VISIBLE_ID}`)
        .expect(200);

      expect(result.body.data).toEqual({ id: VISIBLE_ID });
    });

    it('answers missing and malformed identifiers identically', async () => {
      const hidden = await server()
        .get(`/api/public/probe/${HIDDEN_ID}`)
        .expect(404);
      const malformed = await server()
        .get('/api/public/probe/not-a-uuid')
        .expect(404);

      expect(stripVolatile(hidden.body)).toEqual({
        status_code: 404,
        message: 'Resource not found',
        error: 'Not Found',
        error_code: 'PUBLIC_RESOURCE_NOT_FOUND',
        data: null,
        method: 'GET',
      });
      expect(stripVolatile(malformed.body)).toEqual(stripVolatile(hidden.body));
    });
  });

  describe('protected routes', () => {
    it.each([
      ['get', '/api/specialities'],
      ['get', `/api/specialities/${VISIBLE_ID}`],
      ['post', '/api/specialities'],
      ['patch', `/api/specialities/${VISIBLE_ID}`],
      ['get', `/api/professionals?speciality_id=${VISIBLE_ID}`],
      ['get', '/api/professionals/me'],
      ['get', '/api/professionals/me/patients'],
      ['get', `/api/professionals/${VISIBLE_ID}`],
      ['get', `/api/professionals/${VISIBLE_ID}/reviews`],
      ['post', '/api/professionals'],
      ['post', `/api/professionals/${VISIBLE_ID}/availabilities`],
    ] as const)('still rejects anonymous %s %s', async (method, path) => {
      await server()[method](path).expect(401);

      Object.values(specialityService).forEach((handler) =>
        expect(handler).not.toHaveBeenCalled(),
      );
      Object.values(professionalService).forEach((handler) =>
        expect(handler).not.toHaveBeenCalled(),
      );
    });

    it('still rejects an invalid bearer token', async () => {
      await server()
        .get('/api/specialities')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(401);

      expect(specialityService.findAll).not.toHaveBeenCalled();
    });
  });
});
