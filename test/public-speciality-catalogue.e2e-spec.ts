import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as request from 'supertest';

import { GlobalExceptionFilter } from '../src/common/exceptions/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AuthChallengeValidationPipe } from '../src/modules/auth/challenges/auth-challenge-validation.pipe';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { RefreshSessionService } from '../src/modules/auth/sessions/refresh-session.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { PublicDiscoveryVisibilityPolicy } from '../src/modules/public-discovery/public-discovery-visibility.policy';
import { PublicResourceIdPipe } from '../src/modules/public-discovery/public-resource-id.pipe';
import { Speciality } from '../src/modules/speciality/entities/speciality.entity';
import { PublicSpecialityController } from '../src/modules/speciality/public-speciality.controller';
import { SpecialityController } from '../src/modules/speciality/speciality.controller';
import { SpecialityService } from '../src/modules/speciality/speciality.service';

const VISIBLE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const HIDDEN_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

/**
 * Isolated HTTP test of the public speciality catalogue: the real controller,
 * service, visibility policy, and pipes over a stubbed repository. Behaviour
 * on stored rows is proven separately against PostgreSQL.
 */
describe('Public speciality catalogue (#142)', () => {
  let app: INestApplication;
  const queryBuilder = {
    select: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const validateSession = jest.fn();

  const stored = (overrides: Partial<Speciality> = {}) =>
    Object.assign(new Speciality(), {
      id: VISIBLE_ID,
      name: 'General Doctor',
      description: 'Primary care consultations',
      icon: 'general-doctor',
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
      ...overrides,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'public-speciality-catalogue-test-secret',
        }),
      ],
      controllers: [PublicSpecialityController, SpecialityController],
      providers: [
        SpecialityService,
        PublicDiscoveryVisibilityPolicy,
        PublicResourceIdPipe,
        JwtStrategy,
        RolesGuard,
        { provide: getRepositoryToken(Speciality), useValue: repository },
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
              return 'public-speciality-catalogue-test-secret';
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

  beforeEach(() => {
    jest.resetAllMocks();
    repository.createQueryBuilder.mockReturnValue(queryBuilder);
    (
      ['select', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take'] as const
    ).forEach((method) => queryBuilder[method].mockReturnValue(queryBuilder));
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    queryBuilder.getOne.mockResolvedValue(null);
  });

  const server = () => request(app.getHttpServer());
  const stripVolatile = (body: Record<string, unknown>) => {
    const { timestamp: _timestamp, path: _path, stack: _stack, ...rest } = body;
    return rest;
  };

  describe('catalogue listing', () => {
    it('lists specialities without credentials using only public fields', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [
          stored(),
          stored({
            id: HIDDEN_ID,
            name: 'Nurse',
            description: undefined,
            icon: 'uploads/icons/nurse.png',
          }),
        ],
        2,
      ]);

      const result = await server().get('/api/public/specialities').expect(200);

      expect(result.body).toEqual({
        status_code: 200,
        message: null,
        data: {
          items: [
            {
              id: VISIBLE_ID,
              name: 'General Doctor',
              description: 'Primary care consultations',
              icon: 'general-doctor',
            },
            { id: HIDDEN_ID, name: 'Nurse', description: null, icon: null },
          ],
          meta: {
            page: 1,
            limit: 20,
            total: 2,
            total_pages: 1,
            has_next: false,
            has_previous: false,
          },
        },
      });
      expect(result.headers['set-cookie']).toBeUndefined();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.is_active = :publicSpecialityActive',
        { publicSpecialityActive: true },
      );
    });

    it('ignores supplied credentials instead of evaluating them', async () => {
      await server()
        .get('/api/public/specialities')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(200);

      expect(validateSession).not.toHaveBeenCalled();
    });

    it('applies the requested page, size, and normalized search term', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 12]);

      const result = await server()
        .get('/api/public/specialities')
        .query({ page: '3', limit: '5', q: '  General   DOC ' })
        .expect(200);

      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE :publicSearch'),
        { publicSearch: '%General DOC%' },
      );
      expect(result.body.data.meta).toEqual({
        page: 3,
        limit: 5,
        total: 12,
        total_pages: 3,
        has_next: false,
        has_previous: true,
      });
    });

    it.each([
      [{ limit: '51' }, ['limit must be an integer between 1 and 50']],
      [{ limit: '0' }, ['limit must be an integer between 1 and 50']],
      [{ page: '0' }, ['page must be an integer between 1 and 1000']],
      [{ page: '1001' }, ['page must be an integer between 1 and 1000']],
      [{ page: 'abc' }, ['page must be an integer between 1 and 1000']],
      [{ q: 'a' }, ['q must be text between 2 and 100 characters']],
      [{ q: 'x'.repeat(101) }, ['q must be text between 2 and 100 characters']],
      [{ is_active: 'false' }, ['property is_active should not exist']],
      [{ sort: 'name' }, ['property sort should not exist']],
    ])('rejects the query %p before reading', async (query, message) => {
      const result = await server()
        .get('/api/public/specialities')
        .query(query)
        .expect(400);

      expect(result.body).toMatchObject({
        status_code: 400,
        error: 'Bad Request',
        data: null,
        message,
      });
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it.each(['post', 'put', 'patch', 'delete'] as const)(
      'exposes no %s operation on the public catalogue',
      async (method) => {
        await server()[method]('/api/public/specialities').expect(404);
        await server()
          [method](`/api/public/specialities/${VISIBLE_ID}`)
          .expect(404);

        expect(repository.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('single speciality', () => {
    it('returns one visible speciality without credentials', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      const result = await server()
        .get(`/api/public/specialities/${VISIBLE_ID}`)
        .expect(200);

      expect(result.body.data).toEqual({
        id: VISIBLE_ID,
        name: 'General Doctor',
        description: 'Primary care consultations',
        icon: 'general-doctor',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.is_active = :publicSpecialityActive',
        { publicSpecialityActive: true },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.id = :id',
        { id: VISIBLE_ID },
      );
    });

    it('resolves an upper-case identifier to its canonical form', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      await server()
        .get(`/api/public/specialities/${VISIBLE_ID.toUpperCase()}`)
        .expect(200);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.id = :id',
        { id: VISIBLE_ID },
      );
    });

    it('answers non-public and malformed identifiers identically', async () => {
      const hidden = await server()
        .get(`/api/public/specialities/${HIDDEN_ID}`)
        .expect(404);
      expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);

      const malformed = await server()
        .get('/api/public/specialities/not-a-uuid')
        .expect(404);
      expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);

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

  describe('protected speciality administration', () => {
    it.each([
      ['get', '/api/specialities'],
      ['get', `/api/specialities/${VISIBLE_ID}`],
      ['post', '/api/specialities'],
      ['patch', `/api/specialities/${VISIBLE_ID}`],
    ] as const)('still rejects anonymous %s %s', async (method, path) => {
      await server()[method](path).send({ name: 'Anonymous' }).expect(401);

      Object.values(repository).forEach((handler) =>
        expect(handler).not.toHaveBeenCalled(),
      );
    });

    it('still rejects an invalid bearer token', async () => {
      await server()
        .get('/api/specialities')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(401);

      expect(repository.find).not.toHaveBeenCalled();
    });
  });
});
