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
import { Professional } from '../src/modules/professional/entities/professional.entity';
import { ProfessionalController } from '../src/modules/professional/professional.controller';
import { ProfessionalService } from '../src/modules/professional/professional.service';
import { PublicProfessionalController } from '../src/modules/professional/public-professional.controller';
import { PublicProfessionalService } from '../src/modules/professional/public-professional.service';
import { PublicDiscoveryVisibilityPolicy } from '../src/modules/public-discovery/public-discovery-visibility.policy';
import { PublicDiscoveryClock } from '../src/modules/public-discovery/public-discovery.clock';
import { encodePublicAvailabilityCursor } from '../src/modules/public-discovery/public-discovery.cursor';
import { PublicResourceIdPipe } from '../src/modules/public-discovery/public-resource-id.pipe';

const VISIBLE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const HIDDEN_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const FIRST_SLOT_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_SLOT_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_SLOT_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
const BOOKING_ID = '55555555-5555-4555-8555-555555555555';

// The instant the fixed clock reports. 2031-03-09 ends in every time zone at
// exactly this instant, so it is the last day that counts as over.
const NOW = new Date('2031-03-10T12:00:00.000Z');
const RANGE = { from: '2031-03-10', to: '2031-03-16' };

/**
 * Isolated HTTP test of public availability: the real controller, service,
 * visibility policy, range rule, and pipes over stubbed repositories and a
 * fixed clock. Behaviour on stored slots and bookings is proven separately on
 * PostgreSQL.
 */
describe('Public professional availability (#145)', () => {
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
  const occupancyQueryBuilder = {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getQuery: jest.fn(),
  };
  const slotQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    subQuery: jest.fn(),
    setParameter: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn(),
  };
  const repository = { createQueryBuilder: jest.fn() };
  const reviewRepository = { createQueryBuilder: jest.fn() };
  const availabilityRepository = { createQueryBuilder: jest.fn() };
  const professionalService = {
    findOne: jest.fn(),
    createAvailabilities: jest.fn(),
    createMyAvailabilities: jest.fn(),
  };
  const validateSession = jest.fn();

  // A row as a careless query could return it, with columns of the slot and
  // of the booking that the response must never carry.
  const row = (
    id: string,
    date: string,
    start: string,
    startsAt: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    date,
    start_time: start,
    end_time: '23:59:00',
    time_zone: 'Africa/Lagos',
    starts_at: new Date(startsAt),
    ends_at: new Date(new Date(startsAt).getTime() + 30 * 60_000),
    professional_id: VISIBLE_ID,
    is_available: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    booking_id: BOOKING_ID,
    patient_id: PATIENT_ID,
    status: 'cancelled',
    notes: 'Private appointment note',
    payment_reference: 'PAY-PRIVATE-REFERENCE',
    amount: '5000.00',
    ...overrides,
  });

  const visible = () =>
    queryBuilder.getOne.mockResolvedValue(
      Object.assign(new Professional(), { id: VISIBLE_ID }),
    );

  beforeAll(async () => {
    const secret = 'public-professional-availability-test-secret';
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
        { provide: PublicDiscoveryClock, useValue: { now: () => NOW } },
        { provide: getRepositoryToken(Professional), useValue: repository },
        {
          provide: getRepositoryToken(ProfessionalReview),
          useValue: reviewRepository,
        },
        {
          provide: getRepositoryToken(ProfessionalAvailability),
          useValue: availabilityRepository,
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
    availabilityRepository.createQueryBuilder.mockReturnValue(slotQueryBuilder);
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
    (
      [
        'select',
        'addSelect',
        'where',
        'andWhere',
        'setParameter',
        'orderBy',
        'addOrderBy',
        'limit',
      ] as const
    ).forEach((method) =>
      slotQueryBuilder[method].mockReturnValue(slotQueryBuilder),
    );
    (['select', 'from', 'where', 'andWhere'] as const).forEach((method) =>
      occupancyQueryBuilder[method].mockReturnValue(occupancyQueryBuilder),
    );
    occupancyQueryBuilder.getQuery.mockReturnValue('(OCCUPANCY)');
    slotQueryBuilder.subQuery.mockReturnValue(occupancyQueryBuilder);
    slotQueryBuilder.getRawMany.mockResolvedValue([]);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    queryBuilder.getOne.mockResolvedValue(null);
  });

  const server = () => request(app.getHttpServer());
  const availability = (
    id: string,
    query: Record<string, unknown> | string = RANGE,
  ) =>
    server().get(`/api/public/professionals/${id}/availability`).query(query);
  const stripVolatile = (body: Record<string, unknown>) => {
    const { timestamp: _timestamp, path: _path, stack: _stack, ...rest } = body;
    return rest;
  };
  const readsNothing = () => {
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    expect(availabilityRepository.createQueryBuilder).not.toHaveBeenCalled();
  };

  describe('visible professional', () => {
    it('returns the open slots without credentials', async () => {
      visible();
      slotQueryBuilder.getRawMany.mockResolvedValue([
        row(
          FIRST_SLOT_ID,
          '2031-03-11',
          '09:00:00',
          '2031-03-11T08:00:00.000Z',
        ),
        row(
          SECOND_SLOT_ID,
          '2031-03-11',
          '14:00:00',
          '2031-03-11T13:00:00.000Z',
        ),
        row(
          THIRD_SLOT_ID,
          '2031-03-12',
          '08:00:00',
          '2031-03-12T12:00:00.000Z',
          { time_zone: 'America/New_York' },
        ),
      ]);

      const result = await availability(VISIBLE_ID).expect(200);

      expect(result.headers['content-type']).toMatch(/^application\/json/);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.headers['set-cookie']).toBeUndefined();
      expect(result.body).toEqual({
        status_code: 200,
        message: null,
        data: {
          from: '2031-03-10',
          to: '2031-03-16',
          as_of: '2031-03-10T12:00:00.000Z',
          days: [
            {
              date: '2031-03-11',
              slots: [
                {
                  id: FIRST_SLOT_ID,
                  start_time: '09:00:00',
                  end_time: '23:59:00',
                  time_zone: 'Africa/Lagos',
                  starts_at: '2031-03-11T08:00:00.000Z',
                  ends_at: '2031-03-11T08:30:00.000Z',
                },
                {
                  id: SECOND_SLOT_ID,
                  start_time: '14:00:00',
                  end_time: '23:59:00',
                  time_zone: 'Africa/Lagos',
                  starts_at: '2031-03-11T13:00:00.000Z',
                  ends_at: '2031-03-11T13:30:00.000Z',
                },
              ],
            },
            {
              date: '2031-03-12',
              slots: [
                {
                  id: THIRD_SLOT_ID,
                  start_time: '08:00:00',
                  end_time: '23:59:00',
                  time_zone: 'America/New_York',
                  starts_at: '2031-03-12T12:00:00.000Z',
                  ends_at: '2031-03-12T12:30:00.000Z',
                },
              ],
            },
          ],
          has_more: false,
          next_cursor: null,
        },
      });
    });

    it('returns an empty range as no days', async () => {
      visible();

      const result = await availability(VISIBLE_ID).expect(200);

      expect(result.body.data).toEqual({
        from: '2031-03-10',
        to: '2031-03-16',
        as_of: '2031-03-10T12:00:00.000Z',
        days: [],
        has_more: false,
        next_cursor: null,
      });
    });

    it('discloses nothing about patients, bookings, payments, or slot ownership', async () => {
      visible();
      slotQueryBuilder.getRawMany.mockResolvedValue([
        row(
          FIRST_SLOT_ID,
          '2031-03-11',
          '09:00:00',
          '2031-03-11T08:00:00.000Z',
        ),
      ]);

      const result = await availability(VISIBLE_ID).expect(200);

      [
        VISIBLE_ID,
        PATIENT_ID,
        BOOKING_ID,
        'Private appointment note',
        'PAY-PRIVATE-REFERENCE',
        '5000',
        'cancelled',
        'professional_id',
        'patient_id',
        'booking_id',
        'is_available',
        'created_at',
        'status"',
      ].forEach((value) => expect(result.text).not.toContain(value));
    });

    it('orders the slots chronologically whatever order the rows arrive in', async () => {
      visible();
      slotQueryBuilder.getRawMany.mockResolvedValue([
        row(
          THIRD_SLOT_ID,
          '2031-03-12',
          '09:00:00',
          '2031-03-12T08:00:00.000Z',
        ),
        row(
          SECOND_SLOT_ID,
          '2031-03-11',
          '14:00:00',
          '2031-03-11T13:00:00.000Z',
        ),
        row(
          FIRST_SLOT_ID,
          '2031-03-11',
          '09:00:00',
          '2031-03-11T08:00:00.000Z',
        ),
      ]);

      const result = await availability(VISIBLE_ID).expect(200);

      expect(
        result.body.data.days.map((day: { date: string }) => day.date),
      ).toEqual(['2031-03-11', '2031-03-12']);
      expect(
        result.body.data.days.flatMap((day: { slots: Array<{ id: string }> }) =>
          day.slots.map((slot) => slot.id),
        ),
      ).toEqual([FIRST_SLOT_ID, SECOND_SLOT_ID, THIRD_SLOT_ID]);
    });

    it('returns no more than the bound and says that more exist', async () => {
      visible();
      slotQueryBuilder.getRawMany.mockResolvedValue(
        Array.from({ length: 501 }, (_unused, index) =>
          row(
            `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
            '2031-03-11',
            '09:00:00',
            new Date(NOW.getTime() + (index + 1) * 60_000).toISOString(),
          ),
        ),
      );

      const result = await availability(VISIBLE_ID).expect(200);

      expect(result.body.data.has_more).toBe(true);
      expect(result.body.data.days[0].slots).toHaveLength(500);
      expect(slotQueryBuilder.limit).toHaveBeenCalledWith(501);
      expect(result.body.data.next_cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('continues after the cursor a previous response returned', async () => {
      visible();
      const lastId = '00000000-0000-4000-8000-000000000499';
      const cursor = encodePublicAvailabilityCursor({
        startsAt: new Date('2031-03-11T08:00:00.000Z'),
        id: lastId,
      });

      await availability(VISIBLE_ID, { ...RANGE, cursor }).expect(200);

      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        '((availability.date + availability.start_time) AT TIME ZONE availability.time_zone, availability.id) > (CAST(:publicAfterStartsAt AS timestamptz), CAST(:publicAfterId AS uuid))',
        {
          publicAfterStartsAt: '2031-03-11T08:00:00.000Z',
          publicAfterId: lastId,
        },
      );
    });

    it('applies the visibility rule and binds the identifier, the range, and the instant', async () => {
      visible();

      await availability(VISIBLE_ID).expect(200);

      expect(queryBuilder.andWhere.mock.calls.map(([sql]) => sql)).toEqual([
        'professional.is_active = :publicProfessionalActive',
        'professional.verification_status = :publicProfessionalStatus',
        'account.account_status = :publicAccountStatus',
        'account.email_verified_at IS NOT NULL',
        'speciality.is_active = :publicSpecialityActive',
        'professional.id = :publicProfessionalId',
      ]);
      expect(slotQueryBuilder.where).toHaveBeenCalledWith(
        'availability.professional_id = :publicProfessionalId',
        { publicProfessionalId: VISIBLE_ID },
      );
      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        'availability.date BETWEEN :publicFrom AND :publicTo',
        { publicFrom: '2031-03-10', publicTo: '2031-03-16' },
      );
      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(availability.date + availability.start_time) AT TIME ZONE availability.time_zone > :publicNow',
        { publicNow: NOW },
      );
      expect(slotQueryBuilder.setParameter).toHaveBeenCalledWith(
        'publicCancelledBooking',
        'cancelled',
      );
    });

    it('resolves an upper-case identifier to its canonical form', async () => {
      visible();

      await availability(VISIBLE_ID.toUpperCase()).expect(200);

      expect(queryBuilder.andWhere).toHaveBeenLastCalledWith(
        'professional.id = :publicProfessionalId',
        { publicProfessionalId: VISIBLE_ID },
      );
    });

    it('ignores supplied credentials instead of evaluating them', async () => {
      visible();

      await availability(VISIBLE_ID)
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(200);

      expect(validateSession).not.toHaveBeenCalled();
    });
  });

  describe('date range', () => {
    it.each([
      [
        'a missing range',
        {},
        [
          'from must be a valid calendar date in YYYY-MM-DD format',
          'to must be a valid calendar date in YYYY-MM-DD format',
        ],
      ],
      [
        'a missing end',
        { from: '2031-03-10' },
        ['to must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'a missing start',
        { to: '2031-03-16' },
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'a date that does not exist',
        { from: '2031-02-30', to: '2031-03-02' },
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'a date in another format',
        { from: '2031-03-10', to: '16/03/2031' },
        ['to must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'an instant instead of a date',
        { from: '2031-03-10T00:00:00Z', to: '2031-03-16' },
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'a date with an offset',
        { from: '2031-03-10+01:00', to: '2031-03-16' },
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'a reversed range',
        { from: '2031-03-16', to: '2031-03-10' },
        ['to must be on or after from and cover at most 31 days'],
      ],
      [
        'a range of thirty-two days',
        { from: '2031-03-10', to: '2031-04-10' },
        ['to must be on or after from and cover at most 31 days'],
      ],
      [
        'a repeated bound',
        'from=2031-03-10&from=2031-03-11&to=2031-03-16',
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        'a time zone parameter',
        { ...RANGE, time_zone: 'America/New_York' },
        ['property time_zone should not exist'],
      ],
      [
        'a paging parameter',
        { ...RANGE, limit: '1000' },
        ['property limit should not exist'],
      ],
      [
        'a booking state parameter',
        { ...RANGE, is_available: 'false' },
        ['property is_available should not exist'],
      ],
      [
        'a cursor this endpoint did not issue',
        { ...RANGE, cursor: 'djEuMTIzLm5vdC1hLXV1aWQ' },
        ['cursor must be a next_cursor value returned by this endpoint'],
      ],
      [
        'a cursor that is not base64url',
        { ...RANGE, cursor: '<script>' },
        ['cursor must be a next_cursor value returned by this endpoint'],
      ],
    ])('rejects %s before reading', async (_label, query, messages) => {
      visible();

      const result = await availability(VISIBLE_ID, query).expect(400);

      expect(stripVolatile(result.body)).toEqual({
        status_code: 400,
        message: messages,
        error: 'Bad Request',
        data: null,
        method: 'GET',
      });
      readsNothing();
    });

    it('accepts a single day and the longest range', async () => {
      visible();

      await availability(VISIBLE_ID, {
        from: '2031-03-10',
        to: '2031-03-10',
      }).expect(200);
      await availability(VISIBLE_ID, {
        from: '2031-03-10',
        to: '2031-04-09',
      }).expect(200);
    });

    it('rejects a range that is over everywhere, identically for any professional', async () => {
      const past = { from: '2031-03-01', to: '2031-03-09' };
      visible();
      const forVisible = await availability(VISIBLE_ID, past).expect(400);
      queryBuilder.getOne.mockResolvedValue(null);
      const forHidden = await availability(HIDDEN_ID, past).expect(400);

      expect(stripVolatile(forVisible.body)).toEqual({
        status_code: 400,
        message: ['to must not be a date that has already passed'],
        error: 'Bad Request',
        data: null,
        method: 'GET',
      });
      expect(stripVolatile(forHidden.body)).toEqual(
        stripVolatile(forVisible.body),
      );
      readsNothing();
    });

    it('accepts a range that began in the past and ends on a day that is still current somewhere', async () => {
      visible();

      const result = await availability(VISIBLE_ID, {
        from: '2031-02-10',
        to: '2031-03-10',
      }).expect(200);

      expect(result.body.data).toMatchObject({
        from: '2031-02-10',
        to: '2031-03-10',
      });
    });
  });

  describe('non-public professional', () => {
    it('answers hidden, missing, and malformed identifiers identically', async () => {
      const hidden = await availability(HIDDEN_ID).expect(404);
      expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);

      const malformed = await availability('not-a-uuid').expect(404);
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
      expect(hidden.headers['cache-control']).toBe(
        malformed.headers['cache-control'],
      );
      expect(availabilityRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('answers exactly like the professional detail does', async () => {
      const fromAvailability = await availability(HIDDEN_ID).expect(404);
      const fromDetail = await server()
        .get(`/api/public/professionals/${HIDDEN_ID}`)
        .expect(404);

      expect(stripVolatile(fromAvailability.body)).toEqual(
        stripVolatile(fromDetail.body),
      );
    });

    it.each([
      ['me'],
      ['1'],
      ["3f2504e0-4f89-41d3-9a0c-0305e82c3301' OR '1'='1"],
      ['3f2504e0-4f89-41d3-9a0c-0305e82c330'],
      ['%00'],
    ])('reports the identifier %j as not found before reading', async (id) => {
      const result = await availability(encodeURIComponent(id)).expect(404);

      expect(result.body.error_code).toBe('PUBLIC_RESOURCE_NOT_FOUND');
      readsNothing();
    });

    it('never reads for a malformed identifier with an invalid range', async () => {
      const result = await availability('not-a-uuid', { from: 'tomorrow' });

      // Either refusal is given; neither depends on stored data.
      expect([400, 404]).toContain(result.status);
      readsNothing();
    });
  });

  describe('route boundary', () => {
    it.each(['post', 'put', 'patch', 'delete'] as const)(
      'exposes no %s operation on public availability',
      async (method) => {
        await server()
          [method](`/api/public/professionals/${VISIBLE_ID}/availability`)
          .query(RANGE)
          .send({ slots: [] })
          .expect(404);

        readsNothing();
      },
    );

    it.each([
      [`availability/${FIRST_SLOT_ID}`],
      [`availability/${FIRST_SLOT_ID}/book`],
      ['availabilities'],
      ['slots'],
      ['bookings'],
    ])('exposes no public %s under a professional', async (resource) => {
      await server()
        .get(`/api/public/professionals/${VISIBLE_ID}/${resource}`)
        .query(RANGE)
        .expect(404);

      readsNothing();
    });

    it('keeps the directory and the detail reachable beside availability', async () => {
      await server().get('/api/public/professionals').expect(200);
      await server().get(`/api/public/professionals/${HIDDEN_ID}`).expect(404);

      expect(availabilityRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('protected schedule operations', () => {
    it.each([
      ['get', `/api/professionals/${VISIBLE_ID}`],
      ['post', '/api/professionals/me/availabilities'],
      ['post', `/api/professionals/${VISIBLE_ID}/availabilities`],
    ] as const)('still rejects anonymous %s %s', async (method, path) => {
      await server()[method](path).expect(401);

      Object.values(professionalService).forEach((handler) =>
        expect(handler).not.toHaveBeenCalled(),
      );
      readsNothing();
    });
  });
});
