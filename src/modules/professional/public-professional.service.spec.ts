import { Repository, SelectQueryBuilder } from 'typeorm';

import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import {
  PublicDateRangeQueryDto,
  PublicProfessionalDirectoryQueryDto,
} from '../public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryVisibilityPolicy } from '../public-discovery/public-discovery-visibility.policy';
import { PublicDiscoveryClock } from '../public-discovery/public-discovery.clock';
import {
  PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS,
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../public-discovery/public-discovery.constants';
import { encodePublicAvailabilityCursor } from '../public-discovery/public-discovery.cursor';
import {
  PublicQueryRejectedException,
  PublicResourceNotFoundException,
} from '../public-discovery/public-discovery.errors';
import { IPublicAvailabilitySlotSource } from '../public-discovery/public-discovery.mapper';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';

import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import {
  ConsultationType,
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';
import {
  PUBLIC_AVAILABILITY_RANGE_OVER_MESSAGE,
  PublicProfessionalService,
} from './public-professional.service';

type QueryBuilderMock = jest.Mocked<
  Pick<
    SelectQueryBuilder<Professional>,
    | 'innerJoin'
    | 'select'
    | 'andWhere'
    | 'orderBy'
    | 'addOrderBy'
    | 'offset'
    | 'limit'
    | 'getManyAndCount'
    | 'getOne'
  >
>;

type ReviewQueryBuilderMock = jest.Mocked<
  Pick<
    SelectQueryBuilder<ProfessionalReview>,
    'select' | 'addSelect' | 'where' | 'getRawOne'
  >
>;

type SlotQueryBuilderMock = jest.Mocked<
  Pick<
    SelectQueryBuilder<ProfessionalAvailability>,
    | 'select'
    | 'addSelect'
    | 'where'
    | 'andWhere'
    | 'subQuery'
    | 'setParameter'
    | 'orderBy'
    | 'addOrderBy'
    | 'limit'
    | 'getRawMany'
  >
>;

type OccupancyQueryBuilderMock = jest.Mocked<
  Pick<
    SelectQueryBuilder<Booking>,
    'select' | 'from' | 'where' | 'andWhere' | 'getQuery'
  >
>;

const PROFESSIONAL_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2031-03-10T12:00:00.000Z');

function createQuery(
  overrides: Partial<PublicProfessionalDirectoryQueryDto> = {},
) {
  return Object.assign(new PublicProfessionalDirectoryQueryDto(), overrides);
}

function createStoredProfessional(): Professional {
  return Object.assign(new Professional(), {
    id: '33333333-3333-4333-8333-333333333333',
    image: 'professionals/33/avatar.png',
    rating: '4.50' as unknown as number,
    total_reviews: 12,
    consultation_fee: '5000.00' as unknown as number,
    years_of_experience: 8,
    consultation_type: ConsultationType.BOTH,
    is_available: false,
    user: Object.assign(new User(), {
      id: '22222222-2222-4222-8222-222222222222',
      first_name: 'Ada',
      last_name: 'Obi',
    }),
    speciality: Object.assign(new Speciality(), {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Cardiology',
    }),
  });
}

describe('PublicProfessionalService', () => {
  let queryBuilder: QueryBuilderMock;
  let reviewQueryBuilder: ReviewQueryBuilderMock;
  let slotQueryBuilder: SlotQueryBuilderMock;
  let occupancyQueryBuilders: OccupancyQueryBuilderMock[];
  let repository: { createQueryBuilder: jest.Mock };
  let reviewRepository: { createQueryBuilder: jest.Mock };
  let availabilityRepository: { createQueryBuilder: jest.Mock };
  let clock: jest.Mocked<PublicDiscoveryClock>;
  let service: PublicProfessionalService;

  const predicates = () =>
    queryBuilder.andWhere.mock.calls.map(([sql]) => String(sql));
  const ordering = () => [
    queryBuilder.orderBy.mock.calls[0],
    ...queryBuilder.addOrderBy.mock.calls,
  ];

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    reviewQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ rating: null, total_reviews: '0' }),
    };
    occupancyQueryBuilders = [];
    slotQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      subQuery: jest.fn().mockImplementation(() => {
        const occupancy: OccupancyQueryBuilderMock = {
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getQuery: jest
            .fn()
            .mockReturnValue(`(OCCUPANCY ${occupancyQueryBuilders.length})`),
        };
        occupancyQueryBuilders.push(occupancy);
        return occupancy;
      }),
      setParameter: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    availabilityRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(slotQueryBuilder),
    };
    clock = { now: jest.fn().mockReturnValue(NOW) };
    reviewRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(reviewQueryBuilder),
    };
    service = new PublicProfessionalService(
      repository as unknown as Repository<Professional>,
      reviewRepository as unknown as Repository<ProfessionalReview>,
      availabilityRepository as unknown as Repository<ProfessionalAvailability>,
      new PublicDiscoveryVisibilityPolicy(),
      clock,
    );
  });

  it('always applies the centralized visibility rule', async () => {
    await service.findDirectory(createQuery());

    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'professional.user',
      'account',
    );
    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'professional.speciality',
      'speciality',
    );
    expect(queryBuilder.andWhere.mock.calls).toEqual([
      [
        'professional.is_active = :publicProfessionalActive',
        { publicProfessionalActive: true },
      ],
      [
        'professional.verification_status = :publicProfessionalStatus',
        { publicProfessionalStatus: ProfessionalVerificationStatus.VERIFIED },
      ],
      [
        'account.account_status = :publicAccountStatus',
        { publicAccountStatus: 'active' },
      ],
      ['account.email_verified_at IS NOT NULL'],
      [
        'speciality.is_active = :publicSpecialityActive',
        { publicSpecialityActive: true },
      ],
    ]);
  });

  it('selects only the columns the public summary needs', async () => {
    await service.findDirectory(createQuery());

    const [columns] = queryBuilder.select.mock.calls[0] as [string[]];
    expect([...columns].sort()).toEqual([
      'account.first_name',
      'account.id',
      'account.last_name',
      'professional.consultation_fee',
      'professional.consultation_type',
      'professional.id',
      'professional.image',
      'professional.is_available',
      'professional.rating',
      'professional.total_reviews',
      'professional.years_of_experience',
      'speciality.id',
      'speciality.name',
    ]);
  });

  it('binds every filter as a parameter', async () => {
    await service.findDirectory(
      createQuery({
        speciality_id: '11111111-1111-4111-8111-111111111111',
        min_fee: 1000,
        max_fee: 5000.5,
        q: '100%_care',
      }),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'professional.speciality_id = :publicSpecialityId',
      { publicSpecialityId: '11111111-1111-4111-8111-111111111111' },
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
      { publicSearch: '%100\\%\\_care%' },
    );
    predicates().forEach((sql) => {
      expect(sql).not.toContain('100');
      expect(sql).not.toContain('11111111');
    });
  });

  it('keeps a zero fee bound instead of dropping it', async () => {
    await service.findDirectory(createQuery({ min_fee: 0, max_fee: 0 }));

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'professional.consultation_fee >= :publicMinFee',
      { publicMinFee: 0 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'professional.consultation_fee <= :publicMaxFee',
      { publicMaxFee: 0 },
    );
  });

  it.each([
    [ConsultationType.CHAT, [ConsultationType.CHAT, ConsultationType.BOTH]],
    [ConsultationType.VIDEO, [ConsultationType.VIDEO, ConsultationType.BOTH]],
    [ConsultationType.BOTH, [ConsultationType.BOTH]],
  ])('treats %s as satisfied by %p', async (requested, stored) => {
    await service.findDirectory(createQuery({ consultation_type: requested }));

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'professional.consultation_type IN (:...publicConsultationTypes)',
      { publicConsultationTypes: stored },
    );
  });

  it('adds no optional predicate when no filter is requested', async () => {
    await service.findDirectory(createQuery());

    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(5);
  });

  it.each([
    [
      PublicProfessionalSortField.RATING,
      PublicSortOrder.DESC,
      [
        ['professional.rating', 'DESC'],
        ['professional.id', 'ASC'],
      ],
    ],
    [
      PublicProfessionalSortField.EXPERIENCE,
      PublicSortOrder.ASC,
      [
        ['professional.years_of_experience', 'ASC'],
        ['professional.id', 'ASC'],
      ],
    ],
    [
      PublicProfessionalSortField.CONSULTATION_FEE,
      PublicSortOrder.ASC,
      [
        ['professional.consultation_fee', 'ASC'],
        ['professional.id', 'ASC'],
      ],
    ],
    [
      PublicProfessionalSortField.NAME,
      PublicSortOrder.DESC,
      [
        ['LOWER(account.first_name)', 'DESC'],
        ['LOWER(account.last_name)', 'DESC'],
        ['professional.id', 'ASC'],
      ],
    ],
  ])(
    'orders %s %s by fixed expressions and then identifier',
    async (sort, order, expected) => {
      await service.findDirectory(createQuery({ sort, order }));

      expect(ordering()).toEqual(expected);
    },
  );

  it('never orders by a value outside the allowlist', async () => {
    const forged = createQuery({
      sort: 'license_number; DROP TABLE professionals' as never,
    });

    await expect(service.findDirectory(forged)).rejects.toThrow(TypeError);
    expect(queryBuilder.orderBy).not.toHaveBeenCalled();
    expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
  });

  it.each([
    [1, 20, 0],
    [3, 5, 10],
    [1000, 50, 49950],
  ])('reads page %i of size %i from offset %i', async (page, limit, offset) => {
    await service.findDirectory(createQuery({ page, limit }));

    expect(queryBuilder.offset).toHaveBeenCalledWith(offset);
    expect(queryBuilder.limit).toHaveBeenCalledWith(limit);
  });

  it('returns public summaries with pagination metadata', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([
      [createStoredProfessional()],
      21,
    ]);

    await expect(
      service.findDirectory(createQuery({ page: 2, limit: 20 })),
    ).resolves.toEqual({
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Ada Obi',
          image: null,
          speciality: {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Cardiology',
          },
          rating: 4.5,
          total_reviews: 12,
          consultation_fee: 5000,
          years_of_experience: 8,
          consultation_type: ConsultationType.BOTH,
          is_available: false,
        },
      ],
      meta: {
        page: 2,
        limit: 20,
        total: 21,
        total_pages: 2,
        has_next: false,
        has_previous: true,
      },
    });
  });

  describe('findOne', () => {
    const storedDetail = () =>
      Object.assign(createStoredProfessional(), {
        image: 'https://cdn.example.com/ada.png',
        about: 'Consultant cardiologist',
      });

    it('reads one professional through the centralized visibility rule', async () => {
      queryBuilder.getOne.mockResolvedValue(storedDetail());

      await service.findOne(PROFESSIONAL_ID);

      expect(queryBuilder.andWhere.mock.calls).toEqual([
        [
          'professional.is_active = :publicProfessionalActive',
          { publicProfessionalActive: true },
        ],
        [
          'professional.verification_status = :publicProfessionalStatus',
          {
            publicProfessionalStatus: ProfessionalVerificationStatus.VERIFIED,
          },
        ],
        [
          'account.account_status = :publicAccountStatus',
          { publicAccountStatus: 'active' },
        ],
        ['account.email_verified_at IS NOT NULL'],
        [
          'speciality.is_active = :publicSpecialityActive',
          { publicSpecialityActive: true },
        ],
        [
          'professional.id = :publicProfessionalId',
          { publicProfessionalId: PROFESSIONAL_ID },
        ],
      ]);
    });

    it('selects the biography and not the stored review summary', async () => {
      queryBuilder.getOne.mockResolvedValue(storedDetail());

      await service.findOne(PROFESSIONAL_ID);

      const [columns] = queryBuilder.select.mock.calls[0] as [string[]];
      expect([...columns].sort()).toEqual([
        'account.first_name',
        'account.id',
        'account.last_name',
        'professional.about',
        'professional.consultation_fee',
        'professional.consultation_type',
        'professional.id',
        'professional.image',
        'professional.is_available',
        'professional.years_of_experience',
        'speciality.id',
        'speciality.name',
      ]);
    });

    it('aggregates the review records of that professional only', async () => {
      queryBuilder.getOne.mockResolvedValue(storedDetail());

      await service.findOne(PROFESSIONAL_ID);

      expect(reviewRepository.createQueryBuilder).toHaveBeenCalledWith(
        'review',
      );
      expect(reviewQueryBuilder.select).toHaveBeenCalledWith(
        'ROUND(AVG(review.rating), 2)',
        'rating',
      );
      expect(reviewQueryBuilder.addSelect).toHaveBeenCalledWith(
        'COUNT(*)',
        'total_reviews',
      );
      expect(reviewQueryBuilder.where).toHaveBeenCalledWith(
        'review.professional_id = :publicProfessionalId',
        { publicProfessionalId: PROFESSIONAL_ID },
      );
    });

    it('publishes the profile with the aggregate of the review records', async () => {
      queryBuilder.getOne.mockResolvedValue(storedDetail());
      reviewQueryBuilder.getRawOne.mockResolvedValue({
        rating: '4.67',
        total_reviews: '3',
      });

      await expect(service.findOne(PROFESSIONAL_ID)).resolves.toEqual({
        id: PROFESSIONAL_ID,
        name: 'Ada Obi',
        image: 'https://cdn.example.com/ada.png',
        speciality: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Cardiology',
        },
        rating: 4.67,
        total_reviews: 3,
        consultation_fee: 5000,
        years_of_experience: 8,
        consultation_type: ConsultationType.BOTH,
        is_available: false,
        about: 'Consultant cardiologist',
      });
    });

    it('ignores a stored review summary on the loaded row', async () => {
      queryBuilder.getOne.mockResolvedValue(
        Object.assign(storedDetail(), { rating: '4.90', total_reviews: 120 }),
      );
      reviewQueryBuilder.getRawOne.mockResolvedValue({
        rating: '3.50',
        total_reviews: '2',
      });

      await expect(service.findOne(PROFESSIONAL_ID)).resolves.toMatchObject({
        rating: 3.5,
        total_reviews: 2,
      });
    });

    it.each([[{ rating: null, total_reviews: '0' }], [undefined]])(
      'reports no rating when the aggregate is %p',
      async (aggregate) => {
        queryBuilder.getOne.mockResolvedValue(storedDetail());
        reviewQueryBuilder.getRawOne.mockResolvedValue(aggregate);

        await expect(service.findOne(PROFESSIONAL_ID)).resolves.toMatchObject({
          rating: 0,
          total_reviews: 0,
        });
      },
    );

    it('withholds a biography that is not plain text', async () => {
      queryBuilder.getOne.mockResolvedValue(
        Object.assign(storedDetail(), { about: '<script>alert(1)</script>' }),
      );

      await expect(service.findOne(PROFESSIONAL_ID)).resolves.toMatchObject({
        about: null,
      });
    });

    it('reports a professional the query does not return as not found', async () => {
      await expect(service.findOne(PROFESSIONAL_ID)).rejects.toThrow(
        PublicResourceNotFoundException,
      );
      expect(reviewRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
  describe('availability', () => {
    const STARTS_AT =
      '(availability.date + availability.start_time) AT TIME ZONE availability.time_zone';

    const range = (
      from = '2031-03-10',
      to = '2031-03-16',
    ): PublicDateRangeQueryDto =>
      Object.assign(new PublicDateRangeQueryDto(), { from, to });

    const row = (
      id: string,
      startsAt: string,
    ): IPublicAvailabilitySlotSource => ({
      id,
      date: startsAt.slice(0, 10),
      start_time: '09:00:00',
      end_time: '09:30:00',
      time_zone: 'Africa/Lagos',
      starts_at: new Date(startsAt),
      ends_at: new Date(new Date(startsAt).getTime() + 30 * 60_000),
    });

    const visible = () =>
      queryBuilder.getOne.mockResolvedValue(
        Object.assign(new Professional(), { id: PROFESSIONAL_ID }),
      );

    const slotPredicates = () => [
      String(slotQueryBuilder.where.mock.calls[0][0]),
      ...slotQueryBuilder.andWhere.mock.calls.map(([sql]) => String(sql)),
    ];

    it('checks visibility with the shared rule and reads only the identifier', async () => {
      visible();

      await service.findAvailability(PROFESSIONAL_ID, range());

      expect(queryBuilder.select).toHaveBeenCalledWith(['professional.id']);
      expect(predicates()).toEqual([
        'professional.is_active = :publicProfessionalActive',
        'professional.verification_status = :publicProfessionalStatus',
        'account.account_status = :publicAccountStatus',
        'account.email_verified_at IS NOT NULL',
        'speciality.is_active = :publicSpecialityActive',
        'professional.id = :publicProfessionalId',
      ]);
      expect(queryBuilder.andWhere).toHaveBeenLastCalledWith(
        'professional.id = :publicProfessionalId',
        { publicProfessionalId: PROFESSIONAL_ID },
      );
    });

    it('reports a professional the query does not return as not found and reads no slot', async () => {
      await expect(
        service.findAvailability(PROFESSIONAL_ID, range()),
      ).rejects.toThrow(PublicResourceNotFoundException);

      expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);
      expect(availabilityRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('refuses a range that is over everywhere before any read', async () => {
      visible();
      // 2031-03-09 ends everywhere at 2031-03-10T12:00:00Z, this instant.
      const refused = service.findAvailability(
        PROFESSIONAL_ID,
        range('2031-03-01', '2031-03-09'),
      );

      await expect(refused).rejects.toThrow(PublicQueryRejectedException);
      await expect(refused).rejects.toMatchObject({
        response: {
          message: [PUBLIC_AVAILABILITY_RANGE_OVER_MESSAGE],
          error: 'Bad Request',
          statusCode: 400,
        },
      });
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
      expect(availabilityRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('accepts a range whose last day is still current somewhere', async () => {
      visible();

      await expect(
        service.findAvailability(
          PROFESSIONAL_ID,
          range('2031-03-01', '2031-03-10'),
        ),
      ).resolves.toMatchObject({ days: [] });
    });

    it('reads the clock once and uses that instant throughout', async () => {
      visible();

      const availability = await service.findAvailability(
        PROFESSIONAL_ID,
        range(),
      );

      expect(clock.now).toHaveBeenCalledTimes(1);
      expect(availability.as_of).toBe(NOW.toISOString());
      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        `${STARTS_AT} > :publicNow`,
        { publicNow: NOW },
      );
    });

    it('selects only the published slot columns', async () => {
      visible();

      await service.findAvailability(PROFESSIONAL_ID, range());

      const selected = [
        slotQueryBuilder.select.mock.calls[0],
        ...slotQueryBuilder.addSelect.mock.calls,
      ] as unknown as Array<[expression: string, alias: string]>;
      expect(availabilityRepository.createQueryBuilder).toHaveBeenCalledWith(
        'availability',
      );
      expect(selected.map(([, alias]) => alias)).toEqual([
        'id',
        'date',
        'start_time',
        'end_time',
        'time_zone',
        'starts_at',
        'ends_at',
      ]);
      selected.forEach(([expression]) =>
        expect(String(expression)).not.toMatch(
          /occupying|professional_id|is_available|created_at|updated_at/,
        ),
      );
      expect(selected[5][0]).toBe(STARTS_AT);
    });

    it('keeps only open future slots of that professional inside the range', async () => {
      visible();

      await service.findAvailability(
        PROFESSIONAL_ID,
        range('2031-03-10', '2031-03-16'),
      );

      expect(slotPredicates()).toEqual([
        'availability.professional_id = :publicProfessionalId',
        'availability.date BETWEEN :publicFrom AND :publicTo',
        'availability.is_available = :publicSlotOffered',
        'availability.end_time <> availability.start_time',
        `${STARTS_AT} > :publicNow`,
        'NOT EXISTS (OCCUPANCY 0)',
        'NOT EXISTS (OCCUPANCY 1)',
      ]);
      expect(slotQueryBuilder.where).toHaveBeenCalledWith(
        'availability.professional_id = :publicProfessionalId',
        { publicProfessionalId: PROFESSIONAL_ID },
      );
      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        'availability.date BETWEEN :publicFrom AND :publicTo',
        { publicFrom: '2031-03-10', publicTo: '2031-03-16' },
      );
      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        'availability.is_available = :publicSlotOffered',
        { publicSlotOffered: true },
      );
    });

    it('treats every booking that is not cancelled as occupying its slot', async () => {
      visible();

      await service.findAvailability(PROFESSIONAL_ID, range());

      expect(occupancyQueryBuilders).toHaveLength(2);
      occupancyQueryBuilders.forEach((occupancy) => {
        expect(occupancy.select).toHaveBeenCalledWith('1');
        expect(occupancy.from).toHaveBeenCalledWith(Booking, 'occupying');
        expect(occupancy.andWhere).toHaveBeenCalledWith(
          'occupying.status <> :publicCancelledBooking',
        );
      });
      expect(
        occupancyQueryBuilders.map(
          (occupancy) => occupancy.where.mock.calls[0][0],
        ),
      ).toEqual([
        'occupying.availability_id = availability.id',
        'occupying.professional_id = availability.professional_id AND occupying.booking_date = availability.date AND occupying.booking_time = availability.start_time',
      ]);
      expect(slotQueryBuilder.setParameter).toHaveBeenCalledWith(
        'publicCancelledBooking',
        BookingStatus.CANCELLED,
      );
    });

    it('orders by start instant and identifier and reads one row past the bound', async () => {
      visible();

      await service.findAvailability(PROFESSIONAL_ID, range());

      expect(slotQueryBuilder.orderBy).toHaveBeenCalledWith(STARTS_AT, 'ASC');
      expect(slotQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'availability.id',
        'ASC',
      );
      expect(slotQueryBuilder.limit).toHaveBeenCalledWith(
        PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS + 1,
      );
    });

    it('publishes the slots the query returns', async () => {
      visible();
      slotQueryBuilder.getRawMany.mockResolvedValue([
        row('b', '2031-03-11T08:00:00.000Z'),
        row('a', '2031-03-10T13:00:00.000Z'),
      ]);

      await expect(
        service.findAvailability(PROFESSIONAL_ID, range()),
      ).resolves.toEqual({
        from: '2031-03-10',
        to: '2031-03-16',
        as_of: NOW.toISOString(),
        days: [
          {
            date: '2031-03-10',
            slots: [
              {
                id: 'a',
                start_time: '09:00:00',
                end_time: '09:30:00',
                time_zone: 'Africa/Lagos',
                starts_at: '2031-03-10T13:00:00.000Z',
                ends_at: '2031-03-10T13:30:00.000Z',
              },
            ],
          },
          {
            date: '2031-03-11',
            slots: [
              {
                id: 'b',
                start_time: '09:00:00',
                end_time: '09:30:00',
                time_zone: 'Africa/Lagos',
                starts_at: '2031-03-11T08:00:00.000Z',
                ends_at: '2031-03-11T08:30:00.000Z',
              },
            ],
          },
        ],
        has_more: false,
        next_cursor: null,
      });
    });

    it('publishes no more than the bound and reports that more exist', async () => {
      visible();
      slotQueryBuilder.getRawMany.mockResolvedValue(
        Array.from(
          { length: PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS + 1 },
          (_unused, index) =>
            row(
              String(index).padStart(4, '0'),
              new Date(NOW.getTime() + (index + 1) * 60_000).toISOString(),
            ),
        ),
      );

      const availability = await service.findAvailability(
        PROFESSIONAL_ID,
        range(),
      );
      const published = availability.days.flatMap((day) => day.slots);

      expect(availability.has_more).toBe(true);
      expect(published).toHaveLength(PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS);
      expect(published[published.length - 1].id).toBe('0499');
      expect(availability.next_cursor).toBe(
        encodePublicAvailabilityCursor({
          startsAt: new Date(published[published.length - 1].starts_at),
          id: '0499',
        }),
      );
    });

    it('continues strictly after the cursor in the full order key', async () => {
      visible();
      const after = {
        startsAt: new Date('2031-03-11T08:00:00.000Z'),
        id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      };

      await service.findAvailability(
        PROFESSIONAL_ID,
        Object.assign(range(), {
          cursor: encodePublicAvailabilityCursor(after),
        }),
      );

      expect(slotQueryBuilder.andWhere).toHaveBeenCalledWith(
        `(${STARTS_AT}, availability.id) > (CAST(:publicAfterStartsAt AS timestamptz), CAST(:publicAfterId AS uuid))`,
        {
          publicAfterStartsAt: '2031-03-11T08:00:00.000Z',
          publicAfterId: after.id,
        },
      );
    });

    it('starts from the beginning without a cursor', async () => {
      visible();

      await service.findAvailability(PROFESSIONAL_ID, range());

      expect(slotPredicates().some((sql) => sql.includes('publicAfter'))).toBe(
        false,
      );
    });
  });
});
