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
import { ProfessionalReview } from '../src/modules/professional/entities/professional-review.entity';
import {
  ConsultationType,
  Professional,
} from '../src/modules/professional/entities/professional.entity';
import { ProfessionalController } from '../src/modules/professional/professional.controller';
import { ProfessionalService } from '../src/modules/professional/professional.service';
import { PublicProfessionalController } from '../src/modules/professional/public-professional.controller';
import { PublicProfessionalService } from '../src/modules/professional/public-professional.service';
import { PublicDiscoveryVisibilityPolicy } from '../src/modules/public-discovery/public-discovery-visibility.policy';
import { PublicResourceIdPipe } from '../src/modules/public-discovery/public-resource-id.pipe';
import { Speciality } from '../src/modules/speciality/entities/speciality.entity';
import { User } from '../src/modules/user/entities/user.entity';

const VISIBLE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const HIDDEN_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const SPECIALITY_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';

/**
 * Isolated HTTP test of the public professional detail: the real controller,
 * service, visibility policy, text policy, and pipes over stubbed
 * repositories. Behaviour on stored rows is proven separately on PostgreSQL.
 */
describe('Public professional details (#144)', () => {
  let app: INestApplication;
  const queryBuilder = {
    innerJoin: jest.fn(),
    select: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };
  const reviewQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    getRawOne: jest.fn(),
  };
  const repository = { createQueryBuilder: jest.fn() };
  const reviewRepository = { createQueryBuilder: jest.fn() };
  const professionalService = {
    findBySpeciality: jest.fn(),
    findOne: jest.fn(),
    findMe: jest.fn(),
    getReviews: jest.fn(),
    createProfessional: jest.fn(),
    updateProfessional: jest.fn(),
    createAvailabilities: jest.fn(),
    createReview: jest.fn(),
  };
  const validateSession = jest.fn();

  // A stored row as the entity would be loaded with every column, to prove
  // the response is an allowlist rather than a filtered entity.
  const stored = (overrides: Partial<Professional> = {}) =>
    Object.assign(new Professional(), {
      id: VISIBLE_ID,
      user_id: ACCOUNT_ID,
      speciality_id: SPECIALITY_ID,
      image: 'https://cdn.example.com/ada.png',
      about: 'Consultant cardiologist.\nTen years of clinical practice.',
      license_number: 'LIC-PRIVATE-001',
      rating: '4.90',
      total_reviews: 120,
      consultation_fee: '5000.00',
      years_of_experience: 8,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
      is_active: true,
      verification_status: 'verified',
      profile_setup_completed: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      user: Object.assign(new User(), {
        id: ACCOUNT_ID,
        first_name: 'Ada',
        last_name: 'Obi',
        email: 'private@example.com',
        phone: '+2348000000000',
        dob: '1990-04-12',
        country: 'Privateland',
        password: 'password-hash-value',
        account_status: 'active',
      }),
      speciality: Object.assign(new Speciality(), {
        id: SPECIALITY_ID,
        name: 'Cardiology',
        description: 'Private until the catalogue',
        icon: 'uploads/private/cardiology.png',
        is_active: true,
      }),
      ...overrides,
    });

  beforeAll(async () => {
    const secret = 'public-professional-details-test-secret';
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
      ],
      controllers: [PublicProfessionalController, ProfessionalController],
      providers: [
        PublicProfessionalService,
        PublicDiscoveryVisibilityPolicy,
        PublicResourceIdPipe,
        JwtStrategy,
        RolesGuard,
        { provide: getRepositoryToken(Professional), useValue: repository },
        {
          provide: getRepositoryToken(ProfessionalReview),
          useValue: reviewRepository,
        },
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
              return secret;
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
    reviewRepository.createQueryBuilder.mockReturnValue(reviewQueryBuilder);
    (
      [
        'innerJoin',
        'select',
        'andWhere',
        'orderBy',
        'addOrderBy',
        'offset',
        'limit',
      ] as const
    ).forEach((method) => queryBuilder[method].mockReturnValue(queryBuilder));
    (['select', 'addSelect', 'where'] as const).forEach((method) =>
      reviewQueryBuilder[method].mockReturnValue(reviewQueryBuilder),
    );
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    queryBuilder.getOne.mockResolvedValue(null);
    reviewQueryBuilder.getRawOne.mockResolvedValue({
      rating: null,
      total_reviews: '0',
    });
  });

  const server = () => request(app.getHttpServer());
  const detail = (id: string) =>
    server().get(`/api/public/professionals/${id}`);
  const stripVolatile = (body: Record<string, unknown>) => {
    const { timestamp: _timestamp, path: _path, stack: _stack, ...rest } = body;
    return rest;
  };

  describe('visible professional', () => {
    it('returns the public profile without credentials', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());
      reviewQueryBuilder.getRawOne.mockResolvedValue({
        rating: '4.67',
        total_reviews: '3',
      });

      const result = await detail(VISIBLE_ID).expect(200);

      expect(result.headers['content-type']).toMatch(/^application\/json/);
      expect(result.headers['set-cookie']).toBeUndefined();
      expect(result.body).toEqual({
        status_code: 200,
        message: null,
        data: {
          id: VISIBLE_ID,
          name: 'Ada Obi',
          image: 'https://cdn.example.com/ada.png',
          speciality: { id: SPECIALITY_ID, name: 'Cardiology' },
          rating: 4.67,
          total_reviews: 3,
          consultation_fee: 5000,
          years_of_experience: 8,
          consultation_type: 'both',
          is_available: true,
          about: 'Consultant cardiologist.\nTen years of clinical practice.',
        },
      });
    });

    it('discloses nothing outside the public profile', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      const result = await detail(VISIBLE_ID).expect(200);

      [
        'private@example.com',
        '+2348000000000',
        '1990-04-12',
        'Privateland',
        'LIC-PRIVATE-001',
        'password-hash-value',
        ACCOUNT_ID,
        'uploads/private',
        'Private until the catalogue',
        'verified',
        '4.9',
        '120',
      ].forEach((value) => expect(result.text).not.toContain(value));
    });

    it('applies the visibility rule and binds the identifier', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      await detail(VISIBLE_ID).expect(200);

      expect(queryBuilder.andWhere.mock.calls.map(([sql]) => sql)).toEqual([
        'professional.is_active = :publicProfessionalActive',
        'professional.verification_status = :publicProfessionalStatus',
        'account.account_status = :publicAccountStatus',
        'account.email_verified_at IS NOT NULL',
        'speciality.is_active = :publicSpecialityActive',
        'professional.id = :publicProfessionalId',
      ]);
      expect(queryBuilder.andWhere).toHaveBeenLastCalledWith(
        'professional.id = :publicProfessionalId',
        { publicProfessionalId: VISIBLE_ID },
      );
      expect(reviewQueryBuilder.where).toHaveBeenCalledWith(
        'review.professional_id = :publicProfessionalId',
        { publicProfessionalId: VISIBLE_ID },
      );
    });

    it('reports no rating for a professional without reviews', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      const result = await detail(VISIBLE_ID).expect(200);

      expect(result.body.data).toMatchObject({ rating: 0, total_reviews: 0 });
    });

    it('resolves an upper-case identifier to its canonical form', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      await detail(VISIBLE_ID.toUpperCase()).expect(200);

      expect(queryBuilder.andWhere).toHaveBeenLastCalledWith(
        'professional.id = :publicProfessionalId',
        { publicProfessionalId: VISIBLE_ID },
      );
    });

    it('ignores supplied credentials instead of evaluating them', async () => {
      queryBuilder.getOne.mockResolvedValue(stored());

      await detail(VISIBLE_ID)
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(200);

      expect(validateSession).not.toHaveBeenCalled();
    });
  });

  describe('stored text', () => {
    it.each([
      ['<script>alert(1)</script>'],
      ['Trusted clinician <img src=x onerror=alert(1)>'],
      ['<a href="javascript:alert(1)">book now</a>'],
      ['</script><svg/onload=alert(1)>'],
      ['a'.repeat(4001)],
    ])('withholds the biography %j', async (about) => {
      queryBuilder.getOne.mockResolvedValue(stored({ about }));

      const result = await detail(VISIBLE_ID).expect(200);

      expect(result.body.data.about).toBeNull();
      expect(result.text).not.toMatch(/<[A-Za-z/!?]/);
    });

    it('returns comparison signs and entities in a biography as data', async () => {
      const about = 'BMI > 30 & children < 5. Shown as &lt;b&gt;text&lt;/b&gt;';
      queryBuilder.getOne.mockResolvedValue(stored({ about }));

      const result = await detail(VISIBLE_ID).expect(200);

      expect(result.headers['content-type']).toMatch(/^application\/json/);
      expect(result.body.data.about).toBe(about);
    });

    it('neutralizes markup in the name and speciality name', async () => {
      const professional = stored();
      professional.user.first_name = '<script>alert(1)</script>';
      professional.user.last_name = 'Obi';
      professional.speciality.name = 'Cardio<iframe src=//evil.example>';
      queryBuilder.getOne.mockResolvedValue(professional);

      const result = await detail(VISIBLE_ID).expect(200);

      expect(result.body.data.name).toBe('script>alert(1)/script> Obi');
      expect(result.body.data.speciality.name).toBe(
        'Cardioiframe src=//evil.example>',
      );
      expect(result.text).not.toMatch(/<[A-Za-z/!?]/);
    });
  });

  describe('non-public professional', () => {
    it('answers hidden, missing, and malformed identifiers identically', async () => {
      const hidden = await detail(HIDDEN_ID).expect(404);
      expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);

      const malformed = await detail('not-a-uuid').expect(404);
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
      expect(reviewRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it.each([
      ['me'],
      ['1'],
      ["3f2504e0-4f89-41d3-9a0c-0305e82c3301' OR '1'='1"],
      ['3f2504e0-4f89-41d3-9a0c-0305e82c330'],
      ['%00'],
    ])('reports the identifier %j as not found before reading', async (id) => {
      const result = await detail(encodeURIComponent(id)).expect(404);

      expect(result.body.error_code).toBe('PUBLIC_RESOURCE_NOT_FOUND');
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('route boundary', () => {
    it('keeps the directory reachable beside the detail route', async () => {
      const result = await server()
        .get('/api/public/professionals')
        .expect(200);

      expect(result.body.data).toEqual({
        items: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
      });
      expect(queryBuilder.getOne).not.toHaveBeenCalled();
    });

    it.each(['post', 'put', 'patch', 'delete'] as const)(
      'exposes no %s operation on a public professional',
      async (method) => {
        await server()
          [method](`/api/public/professionals/${VISIBLE_ID}`)
          .expect(404);
      },
    );

    it.each([['reviews'], ['availabilities'], ['bookings'], ['patients']])(
      'exposes no public %s under a professional',
      async (resource) => {
        await server()
          .get(`/api/public/professionals/${VISIBLE_ID}/${resource}`)
          .expect(404);

        expect(repository.createQueryBuilder).not.toHaveBeenCalled();
      },
    );
  });

  describe('protected professional operations', () => {
    it.each([
      ['get', `/api/professionals/${VISIBLE_ID}`],
      ['get', `/api/professionals/${VISIBLE_ID}/reviews`],
      ['get', '/api/professionals/me'],
      ['patch', `/api/professionals/${VISIBLE_ID}`],
      ['post', `/api/professionals/${VISIBLE_ID}/reviews`],
      ['post', `/api/professionals/${VISIBLE_ID}/availabilities`],
    ] as const)('still rejects anonymous %s %s', async (method, path) => {
      await server()[method](path).expect(401);

      Object.values(professionalService).forEach((handler) =>
        expect(handler).not.toHaveBeenCalled(),
      );
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
