import { Repository, SelectQueryBuilder } from 'typeorm';

import { PublicSearchQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryVisibilityPolicy } from '../public-discovery/public-discovery-visibility.policy';
import { PublicResourceNotFoundException } from '../public-discovery/public-discovery.errors';

import { Speciality } from './entities/speciality.entity';
import { SpecialityService } from './speciality.service';

const SPECIALITY_ID = '11111111-1111-4111-8111-111111111111';

function createStoredSpeciality(overrides: Partial<Speciality> = {}) {
  return Object.assign(new Speciality(), {
    id: SPECIALITY_ID,
    name: 'General Doctor',
    description: 'Primary care',
    icon: 'general-doctor',
    ...overrides,
  });
}

function createQuery(overrides: Partial<PublicSearchQueryDto> = {}) {
  return Object.assign(new PublicSearchQueryDto(), overrides);
}

describe('SpecialityService public catalogue', () => {
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Speciality>,
      | 'select'
      | 'andWhere'
      | 'orderBy'
      | 'addOrderBy'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
      | 'getOne'
    >
  >;
  let repository: { createQueryBuilder: jest.Mock; find: jest.Mock };
  let service: SpecialityService;

  beforeEach(() => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      find: jest.fn(),
    };
    service = new SpecialityService(
      repository as unknown as Repository<Speciality>,
      new PublicDiscoveryVisibilityPolicy(),
    );
  });

  describe('findPublicCatalogue', () => {
    it('reads only the published columns of visible specialities', async () => {
      await service.findPublicCatalogue(createQuery());

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('speciality');
      expect(queryBuilder.select).toHaveBeenCalledWith([
        'speciality.id',
        'speciality.name',
        'speciality.description',
        'speciality.icon',
      ]);
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.is_active = :publicSpecialityActive',
        { publicSpecialityActive: true },
      );
    });

    it('orders by name without regard to case and then by identifier', async () => {
      await service.findPublicCatalogue(createQuery());

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'LOWER(speciality.name)',
        'ASC',
      );
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
        'speciality.id',
        'ASC',
      );
    });

    it.each([
      [1, 20, 0],
      [2, 20, 20],
      [5, 7, 28],
      [1000, 50, 49950],
    ])('reads page %i of size %i from offset %i', async (page, limit, skip) => {
      await service.findPublicCatalogue(createQuery({ page, limit }));

      expect(queryBuilder.skip).toHaveBeenCalledWith(skip);
      expect(queryBuilder.take).toHaveBeenCalledWith(limit);
    });

    it('binds the search term as a literal pattern', async () => {
      await service.findPublicCatalogue(createQuery({ q: '100%_care' }));

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "speciality.name ILIKE :publicSearch ESCAPE '\\'",
        { publicSearch: '%100\\%\\_care%' },
      );
    });

    it('adds no search predicate without a term', async () => {
      await service.findPublicCatalogue(createQuery());

      const predicates = queryBuilder.andWhere.mock.calls.map(([sql]) => sql);
      expect(predicates.some((sql) => String(sql).includes('ILIKE'))).toBe(
        false,
      );
    });

    it('returns public items with pagination metadata', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [
          createStoredSpeciality(),
          createStoredSpeciality({
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Nurse',
            description: undefined,
            icon: 'internal/icons/nurse.png',
          }),
        ],
        41,
      ]);

      await expect(
        service.findPublicCatalogue(createQuery({ page: 2, limit: 20 })),
      ).resolves.toEqual({
        items: [
          {
            id: SPECIALITY_ID,
            name: 'General Doctor',
            description: 'Primary care',
            icon: 'general-doctor',
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Nurse',
            description: null,
            icon: null,
          },
        ],
        meta: {
          page: 2,
          limit: 20,
          total: 41,
          total_pages: 3,
          has_next: true,
          has_previous: true,
        },
      });
    });

    it('returns an empty page beyond the last one', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 3]);

      await expect(
        service.findPublicCatalogue(createQuery({ page: 9, limit: 20 })),
      ).resolves.toEqual({
        items: [],
        meta: {
          page: 9,
          limit: 20,
          total: 3,
          total_pages: 1,
          has_next: false,
          has_previous: true,
        },
      });
    });
  });

  describe('findPublicById', () => {
    it('returns a visible speciality as the public model', async () => {
      queryBuilder.getOne.mockResolvedValue(
        createStoredSpeciality({
          is_active: true,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );

      await expect(service.findPublicById(SPECIALITY_ID)).resolves.toEqual({
        id: SPECIALITY_ID,
        name: 'General Doctor',
        description: 'Primary care',
        icon: 'general-doctor',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.is_active = :publicSpecialityActive',
        { publicSpecialityActive: true },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'speciality.id = :id',
        { id: SPECIALITY_ID },
      );
    });

    it('reports a speciality the query does not return as not found', async () => {
      await expect(service.findPublicById(SPECIALITY_ID)).rejects.toThrow(
        PublicResourceNotFoundException,
      );
    });
  });

  describe('protected reads', () => {
    it('still lists active specialities with their administrative fields', async () => {
      const stored = createStoredSpeciality({
        is_active: true,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
      });
      repository.find.mockResolvedValue([stored]);

      await expect(service.findAll()).resolves.toEqual([
        {
          id: SPECIALITY_ID,
          name: 'General Doctor',
          description: 'Primary care',
          icon: 'general-doctor',
          is_active: true,
          created_at: stored.created_at,
          updated_at: stored.updated_at,
        },
      ]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { is_active: true },
        order: { name: 'ASC' },
      });
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
