import { Repository, SelectQueryBuilder } from 'typeorm';

import { PublicProfessionalDirectoryQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryVisibilityPolicy } from '../public-discovery/public-discovery-visibility.policy';
import {
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../public-discovery/public-discovery.constants';
import { PublicResourceNotFoundException } from '../public-discovery/public-discovery.errors';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';

import { ProfessionalReview } from './entities/professional-review.entity';
import {
  ConsultationType,
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';
import { PublicProfessionalService } from './public-professional.service';

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

const PROFESSIONAL_ID = '33333333-3333-4333-8333-333333333333';

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
  let repository: { createQueryBuilder: jest.Mock };
  let reviewRepository: { createQueryBuilder: jest.Mock };
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
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    reviewRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(reviewQueryBuilder),
    };
    service = new PublicProfessionalService(
      repository as unknown as Repository<Professional>,
      reviewRepository as unknown as Repository<ProfessionalReview>,
      new PublicDiscoveryVisibilityPolicy(),
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
});
