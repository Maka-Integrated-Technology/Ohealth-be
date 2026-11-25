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
import { RefreshSessionService } from '../src/modules/auth/sessions/refresh-session.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { ProfessionalAvailability } from '../src/modules/professional/entities/professional-availability.entity';
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
import { PublicDiscoveryClock } from '../src/modules/public-discovery/public-discovery.clock';
import { Speciality } from '../src/modules/speciality/entities/speciality.entity';
import { User } from '../src/modules/user/entities/user.entity';

const PROFESSIONAL_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const SPECIALITY_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const FEE_MESSAGE =
  'must be an amount between 0 and 99999999.99 with at most 2 decimal places';

/**
 * Isolated HTTP test of the public professional directory: the real
 * controller, service, visibility policy, and validation over a stubbed
 * repository. Behaviour on stored rows is proven separately on PostgreSQL.
 */
describe('Public professional directory (#143)', () => {
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
  };
  const repository = { createQueryBuilder: jest.fn() };
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
  const stored = () =>
    Object.assign(new Professional(), {
      id: PROFESSIONAL_ID,
      user_id: '22222222-2222-4222-8222-222222222222',
      speciality_id: SPECIALITY_ID,
      image: 'https://cdn.example.com/ada.png',
      about: 'Private until the detail endpoint',
      license_number: 'LIC-PRIVATE-001',
      rating: '4.50',
      total_reviews: 12,
      consultation_fee: '5000.00',
      years_of_experience: 8,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
      is_active: true,
      verification_status: 'verified',
      profile_setup_completed: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      user: Object.assign(new User(), {
        id: '22222222-2222-4222-8222-222222222222',
        first_name: 'Ada',
        last_name: 'Obi',
        email: 'private@example.com',
        phone: '+2348000000000',
        dob: '1990-04-12',
        password: 'password-hash-value',
        account_status: 'active',
      }),
      speciality: Object.assign(new Speciality(), {
        id: SPECIALITY_ID,
        name: 'Cardiology',
        icon: 'uploads/private/cardiology.png',
        is_active: true,
      }),
    });

  beforeAll(async () => {
    const secret = 'public-professional-directory-test-secret';
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
      ],
      controllers: [PublicProfessionalController, ProfessionalController],
      providers: [
        PublicProfessionalService,
        PublicDiscoveryClock,
        PublicDiscoveryVisibilityPolicy,
        JwtStrategy,
        { provide: getRepositoryToken(Professional), useValue: repository },
        { provide: getRepositoryToken(ProfessionalReview), useValue: {} },
        {
          provide: getRepositoryToken(ProfessionalAvailability),
          useValue: {},
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
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
  });

  const server = () => request(app.getHttpServer());
  const directory = () => server().get('/api/public/professionals');

  describe('directory listing', () => {
    it('lists professionals without credentials using only the public summary', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[stored()], 1]);

      const result = await directory().expect(200);

      expect(result.body).toEqual({
        status_code: 200,
        message: null,
        data: {
          items: [
            {
              id: PROFESSIONAL_ID,
              name: 'Ada Obi',
              image: 'https://cdn.example.com/ada.png',
              speciality: { id: SPECIALITY_ID, name: 'Cardiology' },
              rating: 4.5,
              total_reviews: 12,
              consultation_fee: 5000,
              years_of_experience: 8,
              consultation_type: 'both',
              is_available: true,
            },
          ],
          meta: {
            page: 1,
            limit: 20,
            total: 1,
            total_pages: 1,
            has_next: false,
            has_previous: false,
          },
        },
      });
      expect(result.headers['set-cookie']).toBeUndefined();

      const serialized = JSON.stringify(result.body);
      [
        'private@example.com',
        '+2348000000000',
        '1990-04-12',
        'LIC-PRIVATE-001',
        'password-hash-value',
        'Private until the detail endpoint',
        '22222222-2222-4222-8222-222222222222',
        'uploads/private',
        'verified',
      ].forEach((value) => expect(serialized).not.toContain(value));
    });

    it('applies the visibility rule to every request', async () => {
      await directory().expect(200);

      const predicates = queryBuilder.andWhere.mock.calls.map(([sql]) => sql);
      expect(predicates).toEqual([
        'professional.is_active = :publicProfessionalActive',
        'professional.verification_status = :publicProfessionalStatus',
        'account.account_status = :publicAccountStatus',
        'account.email_verified_at IS NOT NULL',
        'speciality.is_active = :publicSpecialityActive',
      ]);
    });

    it('ignores supplied credentials instead of evaluating them', async () => {
      await directory()
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(200);

      expect(validateSession).not.toHaveBeenCalled();
    });

    it('applies every supported filter, sort, and page parameter', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 42]);

      const result = await directory()
        .query({
          q: '  ada   OBI ',
          speciality_id: SPECIALITY_ID,
          consultation_type: 'video',
          min_fee: '1000',
          max_fee: '5000.50',
          sort: 'consultation_fee',
          order: 'asc',
          page: '3',
          limit: '10',
        })
        .expect(200);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'professional.speciality_id = :publicSpecialityId',
        { publicSpecialityId: SPECIALITY_ID },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'professional.consultation_type IN (:...publicConsultationTypes)',
        { publicConsultationTypes: ['video', 'both'] },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'professional.consultation_fee >= :publicMinFee',
        { publicMinFee: 1000 },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'professional.consultation_fee <= :publicMaxFee',
        { publicMaxFee: 5000.5 },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE :publicSearch'),
        { publicSearch: '%ada OBI%' },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'professional.consultation_fee',
        'ASC',
      );
      expect(queryBuilder.addOrderBy).toHaveBeenLastCalledWith(
        'professional.id',
        'ASC',
      );
      expect(queryBuilder.offset).toHaveBeenCalledWith(20);
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result.body.data.meta).toEqual({
        page: 3,
        limit: 10,
        total: 42,
        total_pages: 5,
        has_next: true,
        has_previous: true,
      });
    });

    it.each([
      [{ limit: '51' }, ['limit must be an integer between 1 and 50']],
      [{ page: '0' }, ['page must be an integer between 1 and 1000']],
      [{ page: '1001' }, ['page must be an integer between 1 and 1000']],
      [{ q: 'a' }, ['q must be text between 2 and 100 characters']],
      [{ speciality_id: 'cardiology' }, ['speciality_id must be a UUID']],
      [
        { consultation_type: 'in_person' },
        ['consultation_type must be one of: chat, video, both'],
      ],
      [
        { sort: 'license_number' },
        ['sort must be one of: rating, experience, consultation_fee, name'],
      ],
      [
        { sort: 'rating; DROP TABLE professionals' },
        ['sort must be one of: rating, experience, consultation_fee, name'],
      ],
      [{ order: 'random()' }, ['order must be one of: asc, desc']],
      [{ min_fee: '-1' }, [`min_fee ${FEE_MESSAGE}`]],
      [{ max_fee: '1e9' }, [`max_fee ${FEE_MESSAGE}`]],
      [{ max_fee: '10.999' }, [`max_fee ${FEE_MESSAGE}`]],
      [
        { min_fee: '5000', max_fee: '100' },
        ['max_fee must be greater than or equal to min_fee'],
      ],
      [{ location: 'Lagos' }, ['property location should not exist']],
      [{ country: 'NG' }, ['property country should not exist']],
      [{ is_available: 'true' }, ['property is_available should not exist']],
      [
        { verification_status: 'pending' },
        ['property verification_status should not exist'],
      ],
      [{ is_active: 'false' }, ['property is_active should not exist']],
      [{ role: 'doctor' }, ['property role should not exist']],
      [{ cursor: 'abc' }, ['property cursor should not exist']],
    ])('rejects the query %p before reading', async (query, message) => {
      const result = await directory().query(query).expect(400);

      expect(result.body).toMatchObject({
        status_code: 400,
        error: 'Bad Request',
        data: null,
        message,
      });
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it.each(['post', 'put', 'patch', 'delete'] as const)(
      'exposes no %s operation on the public directory',
      async (method) => {
        await server()[method]('/api/public/professionals').expect(404);
      },
    );
  });

  describe('protected professional operations', () => {
    it.each([
      ['get', `/api/professionals?speciality_id=${SPECIALITY_ID}`],
      ['get', '/api/professionals/me'],
      ['get', '/api/professionals/me/dashboard'],
      ['get', '/api/professionals/me/patients'],
      ['get', `/api/professionals/${PROFESSIONAL_ID}`],
      ['get', `/api/professionals/${PROFESSIONAL_ID}/reviews`],
      ['post', '/api/professionals'],
      ['patch', `/api/professionals/${PROFESSIONAL_ID}`],
      ['post', `/api/professionals/${PROFESSIONAL_ID}/availabilities`],
      ['post', `/api/professionals/${PROFESSIONAL_ID}/reviews`],
    ] as const)('still rejects anonymous %s %s', async (method, path) => {
      await server()[method](path).expect(401);

      Object.values(professionalService).forEach((handler) =>
        expect(handler).not.toHaveBeenCalled(),
      );
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('still rejects an invalid bearer token', async () => {
      await server()
        .get(`/api/professionals?speciality_id=${SPECIALITY_ID}`)
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(401);

      expect(professionalService.findBySpeciality).not.toHaveBeenCalled();
    });
  });
});
