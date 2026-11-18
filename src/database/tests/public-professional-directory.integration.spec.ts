import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, Logger, Repository } from 'typeorm';

import { ProfessionalAvailability } from '../../modules/professional/entities/professional-availability.entity';
import { ProfessionalReview } from '../../modules/professional/entities/professional-review.entity';
import {
  ConsultationType,
  Professional,
  ProfessionalVerificationStatus,
} from '../../modules/professional/entities/professional.entity';
import { PublicProfessionalService } from '../../modules/professional/public-professional.service';
import { PublicProfessionalDirectoryQueryDto } from '../../modules/public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryVisibilityPolicy } from '../../modules/public-discovery/public-discovery-visibility.policy';
import { PublicDiscoveryClock } from '../../modules/public-discovery/public-discovery.clock';
import {
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../../modules/public-discovery/public-discovery.constants';
import { Speciality } from '../../modules/speciality/entities/speciality.entity';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

type SpecialityKey = 'cardiology' | 'nursing' | 'retired';

interface ISeed {
  key: string;
  firstName: string;
  lastName: string;
  speciality: SpecialityKey;
  fee: number;
  rating: number;
  experience: number;
  type: ConsultationType;
  visible: boolean;
  professional?: Partial<Professional>;
  user?: Partial<User>;
}

const visible = (
  key: string,
  firstName: string,
  lastName: string,
  speciality: SpecialityKey,
  fee: number,
  rating: number,
  experience: number,
  type: ConsultationType,
): ISeed => ({
  key,
  firstName,
  lastName,
  speciality,
  fee,
  rating,
  experience,
  type,
  visible: true,
});

// Hidden rows carry the best rating, a mid-range fee, and both consultation
// modes, so any filter or sort that ignored visibility would surface them.
const hidden = (
  key: string,
  overrides: Pick<ISeed, 'professional' | 'user'> & {
    speciality?: SpecialityKey;
  },
): ISeed => ({
  key,
  firstName: 'Hidden',
  lastName: key,
  speciality: overrides.speciality ?? 'cardiology',
  fee: 3000,
  rating: 5,
  experience: 30,
  type: ConsultationType.BOTH,
  visible: false,
  professional: overrides.professional,
  user: overrides.user,
});

const SEEDS: ISeed[] = [
  visible(
    'ada',
    'Ada',
    'Obi',
    'cardiology',
    5000,
    4.8,
    10,
    ConsultationType.BOTH,
  ),
  visible(
    'ben',
    'ben',
    'Okafor',
    'cardiology',
    3000,
    4.8,
    5,
    ConsultationType.CHAT,
  ),
  visible(
    'chi',
    'Chi',
    'Ade',
    'nursing',
    1500.5,
    3.2,
    2,
    ConsultationType.VIDEO,
  ),
  visible(
    'dan',
    'Dan',
    "O'Neil",
    'nursing',
    8000,
    5,
    20,
    ConsultationType.BOTH,
  ),
  visible(
    'eve',
    'Eve',
    '100%_Test',
    'cardiology',
    3000,
    4.1,
    5,
    ConsultationType.VIDEO,
  ),
  hidden('inactive-profile', { professional: { is_active: false } }),
  hidden('pending-review', {
    professional: {
      verification_status: ProfessionalVerificationStatus.PENDING,
    },
  }),
  hidden('rejected-review', {
    professional: {
      verification_status: ProfessionalVerificationStatus.REJECTED,
    },
  }),
  hidden('pending-account', {
    user: {
      account_status: AccountStatus.PENDING_VERIFICATION,
      email_verified_at: null,
    },
  }),
  hidden('suspended-account', {
    user: { account_status: AccountStatus.SUSPENDED },
  }),
  hidden('deactivated-account', {
    user: { account_status: AccountStatus.DEACTIVATED },
  }),
  hidden('inactive-speciality', { speciality: 'retired' }),
];

const SUMMARY_FIELDS = [
  'consultation_fee',
  'consultation_type',
  'id',
  'image',
  'is_available',
  'name',
  'rating',
  'speciality',
  'total_reviews',
  'years_of_experience',
];

// Runs every migration into a disposable database, then drives the real
// PublicProfessionalService against stored professionals, accounts, and
// specialities in every visibility state.
integration('Public professional directory on real PostgreSQL', () => {
  const policy = new PublicDiscoveryVisibilityPolicy();
  const databaseName = 'directory_' + randomUUID().replaceAll('-', '');
  const statements: Array<{ sql: string; parameters: unknown[] }> = [];
  let admin: DataSource;
  let database: DataSource;
  let professionals: Repository<Professional>;
  let service: PublicProfessionalService;
  const ids = new Map<string, string>();
  const userIds = new Map<string, string>();
  const specialityIds = {} as Record<SpecialityKey, string>;

  const recorder: Logger = {
    logQuery: (sql, parameters) =>
      statements.push({ sql, parameters: parameters ?? [] }),
    logQueryError: () => undefined,
    logQuerySlow: () => undefined,
    logSchemaBuild: () => undefined,
    logMigration: () => undefined,
    log: () => undefined,
  };

  const idOf = (key: string): string => ids.get(key) as string;
  /** Keys in the order given, with ties resolved by ascending identifier. */
  const tied = (...keys: string[]): string[] => keys.map(idOf).sort();
  const list = (overrides: Partial<PublicProfessionalDirectoryQueryDto> = {}) =>
    service.findDirectory(
      Object.assign(new PublicProfessionalDirectoryQueryDto(), overrides),
    );
  const listIds = async (
    overrides: Partial<PublicProfessionalDirectoryQueryDto> = {},
  ) => (await list(overrides)).items.map((item) => item.id);
  const byName = {
    sort: PublicProfessionalSortField.NAME,
    order: PublicSortOrder.ASC,
  };

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${databaseName}"`);

    const url = new URL(env.PG_INTEGRATION_URL);
    url.pathname = '/' + databaseName;
    database = new DataSource({
      type: 'postgres',
      url: url.toString(),
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      migrations: [__dirname + '/../migrations/*.ts'],
      synchronize: false,
      logging: ['query'],
      logger: recorder,
    });
    await database.initialize();
    await database.runMigrations();

    professionals = database.getRepository(Professional);
    service = new PublicProfessionalService(
      professionals,
      database.getRepository(ProfessionalReview),
      database.getRepository(ProfessionalAvailability),
      policy,
      new PublicDiscoveryClock(),
    );
    const specialities = database.getRepository(Speciality);
    const users = database.getRepository(User);

    const specialitySeeds: Array<[SpecialityKey, string, boolean]> = [
      ['cardiology', 'Directory Cardiology', true],
      ['nursing', 'Directory Nursing', true],
      ['retired', 'Directory Retired', false],
    ];
    for (const [key, name, active] of specialitySeeds) {
      const saved = await specialities.save(
        specialities.create({ name, is_active: active }),
      );
      specialityIds[key] = saved.id;
    }

    for (const seed of SEEDS) {
      const accountStatus = seed.user?.account_status ?? AccountStatus.ACTIVE;
      const emailVerifiedAt =
        seed.user && 'email_verified_at' in seed.user
          ? seed.user.email_verified_at
          : new Date('2026-01-01T00:00:00.000Z');
      // The legacy flags must mirror canonical state or the schema rejects
      // the row (CHK_users_canonical_account_access).
      const user = await users.save(
        users.create({
          email: `${seed.key}@private.example.com`,
          password: 'stored-password-hash',
          first_name: seed.firstName,
          last_name: seed.lastName,
          phone: '+2348000000000',
          dob: '1990-04-12',
          country: 'Privateland',
          account_status: accountStatus,
          email_verified_at: emailVerifiedAt,
          is_active: accountStatus === AccountStatus.ACTIVE,
          is_verified: emailVerifiedAt instanceof Date,
        }),
      );
      const professional = await professionals.save(
        professionals.create({
          user_id: user.id,
          speciality_id: specialityIds[seed.speciality],
          license_number: `LIC-${seed.key}`,
          consultation_fee: seed.fee,
          rating: seed.rating,
          years_of_experience: seed.experience,
          consultation_type: seed.type,
          total_reviews: 3,
          is_active: true,
          is_available: true,
          verification_status: ProfessionalVerificationStatus.VERIFIED,
          about: 'Private until the detail endpoint',
          image: 'https://cdn.example.com/profile.png',
          ...seed.professional,
        }),
      );
      ids.set(seed.key, professional.id);
      userIds.set(seed.key, user.id);
    }
  }, 120_000);

  afterAll(async () => {
    await database?.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  });

  describe('visibility', () => {
    it('lists exactly the active, approved professionals of active accounts', async () => {
      const result = await list({ limit: 50 });
      const expected = SEEDS.filter((seed) => seed.visible).map((seed) =>
        idOf(seed.key),
      );

      expect(result.items.map((item) => item.id).sort()).toEqual(
        expected.sort(),
      );
      expect(result.meta.total).toBe(expected.length);
    });

    it('agrees with the in-memory rule for every stored professional', async () => {
      const listed = new Set(await listIds({ limit: 50 }));
      const stored = await professionals.find({
        relations: ['user', 'speciality'],
      });

      expect(stored).toHaveLength(SEEDS.length);
      stored.forEach((professional) =>
        expect(listed.has(professional.id)).toBe(
          policy.isProfessionalVisible(professional),
        ),
      );
    });

    it.each(SEEDS.filter((seed) => !seed.visible).map((seed) => [seed.key]))(
      'never returns the %s professional through any filter',
      async (key) => {
        const attempts = [
          { q: key },
          { q: 'Hidden' },
          { min_fee: 3000, max_fee: 3000 },
          { consultation_type: ConsultationType.BOTH },
          { speciality_id: specialityIds.retired },
          { sort: PublicProfessionalSortField.RATING, limit: 1 },
        ];

        for (const attempt of attempts) {
          expect(await listIds({ limit: 50, ...attempt })).not.toContain(
            idOf(key),
          );
        }
      },
    );
  });

  describe('sorting', () => {
    it('defaults to rating descending with an identifier tie-breaker', async () => {
      expect(await listIds()).toEqual([
        idOf('dan'),
        ...tied('ada', 'ben'),
        idOf('eve'),
        idOf('chi'),
      ]);
    });

    it.each([
      [
        PublicProfessionalSortField.RATING,
        PublicSortOrder.ASC,
        [['chi'], ['eve'], ['ada', 'ben'], ['dan']],
      ],
      [
        PublicProfessionalSortField.EXPERIENCE,
        PublicSortOrder.DESC,
        [['dan'], ['ada'], ['ben', 'eve'], ['chi']],
      ],
      [
        PublicProfessionalSortField.EXPERIENCE,
        PublicSortOrder.ASC,
        [['chi'], ['ben', 'eve'], ['ada'], ['dan']],
      ],
      [
        PublicProfessionalSortField.CONSULTATION_FEE,
        PublicSortOrder.ASC,
        [['chi'], ['ben', 'eve'], ['ada'], ['dan']],
      ],
      [
        PublicProfessionalSortField.CONSULTATION_FEE,
        PublicSortOrder.DESC,
        [['dan'], ['ada'], ['ben', 'eve'], ['chi']],
      ],
      [
        PublicProfessionalSortField.NAME,
        PublicSortOrder.ASC,
        [['ada'], ['ben'], ['chi'], ['dan'], ['eve']],
      ],
      [
        PublicProfessionalSortField.NAME,
        PublicSortOrder.DESC,
        [['eve'], ['dan'], ['chi'], ['ben'], ['ada']],
      ],
    ])('orders by %s %s', async (sort, order, groups) => {
      expect(await listIds({ sort, order })).toEqual(
        groups.flatMap((group) => tied(...group)),
      );
    });
  });

  describe('filters', () => {
    it('filters by canonical speciality', async () => {
      expect(
        await listIds({ ...byName, speciality_id: specialityIds.cardiology }),
      ).toEqual(['ada', 'ben', 'eve'].map(idOf));
      expect(
        await listIds({ ...byName, speciality_id: specialityIds.nursing }),
      ).toEqual(['chi', 'dan'].map(idOf));
    });

    it('returns an empty page for an inactive or unknown speciality', async () => {
      for (const specialityId of [specialityIds.retired, randomUUID()]) {
        await expect(
          list({ speciality_id: specialityId }),
        ).resolves.toMatchObject({
          items: [],
          meta: { total: 0, total_pages: 0 },
        });
      }
    });

    it.each([
      [ConsultationType.CHAT, ['ada', 'ben', 'dan']],
      [ConsultationType.VIDEO, ['ada', 'chi', 'dan', 'eve']],
      [ConsultationType.BOTH, ['ada', 'dan']],
    ])('filters by the %s consultation type', async (type, keys) => {
      expect(await listIds({ ...byName, consultation_type: type })).toEqual(
        keys.map(idOf),
      );
    });

    it.each([
      [{ min_fee: 3000 }, ['ada', 'ben', 'dan', 'eve']],
      [{ max_fee: 3000 }, ['ben', 'chi', 'eve']],
      [{ min_fee: 3000, max_fee: 3000 }, ['ben', 'eve']],
      [{ max_fee: 1500.5 }, ['chi']],
      [{ max_fee: 1500.49 }, []],
      [{ min_fee: 1500.51, max_fee: 2999.99 }, []],
      [{ min_fee: 8000 }, ['dan']],
      [
        { min_fee: 0, max_fee: 99_999_999.99 },
        ['ada', 'ben', 'chi', 'dan', 'eve'],
      ],
    ])('filters by the inclusive fee bounds %p', async (bounds, keys) => {
      expect(await listIds({ ...byName, ...bounds })).toEqual(keys.map(idOf));
    });

    it('combines filters', async () => {
      expect(
        await listIds({
          speciality_id: specialityIds.cardiology,
          consultation_type: ConsultationType.VIDEO,
          max_fee: 3000,
          q: 'eve',
        }),
      ).toEqual([idOf('eve')]);
    });
  });

  describe('search', () => {
    it.each([
      ['ADA', ['ada']],
      ['da ob', ['ada']],
      ['BEN oka', ['ben']],
      ["o'neil", ['dan']],
      ['nurs', ['chi', 'dan']],
      ['directory CARDIO', ['ada', 'ben', 'eve']],
      ['0%_T', ['eve']],
      ['100%', ['eve']],
    ])(
      'matches %p against the display name or speciality name',
      async (q, keys) => {
        expect(await listIds({ ...byName, q })).toEqual(keys.map(idOf));
      },
    );

    it.each([
      ['%%'],
      ['__'],
      ['a%a'],
      ['A_a'],
      ["' OR '1'='1"],
      ["'; DROP TABLE professionals; --"],
      ['\\'],
    ])('treats %p as plain text', async (q) => {
      await expect(list({ q })).resolves.toMatchObject({
        items: [],
        meta: { total: 0 },
      });
      await expect(professionals.count()).resolves.toBe(SEEDS.length);
    });

    it.each([
      ['ada@private.example.com'],
      ['private.example.com'],
      ['+2348000000000'],
      ['LIC-ada'],
      ['Privateland'],
      ['1990-04-12'],
      ['Private until'],
      ['verified'],
    ])('does not search the private field value %p', async (q) => {
      expect(await listIds({ q })).toEqual([]);
    });
  });

  describe('pagination', () => {
    it('pages through the directory without gaps or repeats', async () => {
      const whole = await listIds({ limit: 50 });
      const paged: string[] = [];

      for (const page of [1, 2, 3]) {
        const result = await list({ page, limit: 2 });
        paged.push(...result.items.map((item) => item.id));
        expect(result.meta).toEqual({
          page,
          limit: 2,
          total: 5,
          total_pages: 3,
          has_next: page < 3,
          has_previous: page > 1,
        });
      }

      expect(paged).toEqual(whole);
    });

    it('returns an empty page beyond the last one', async () => {
      await expect(list({ page: 4, limit: 2 })).resolves.toMatchObject({
        items: [],
        meta: { total: 5, has_next: false, has_previous: true },
      });
    });
  });

  describe('projection and query shape', () => {
    it('publishes only the public summary of a stored professional', async () => {
      const [item] = (await list({ q: 'Ada Obi' })).items;

      expect(item).toEqual({
        id: idOf('ada'),
        name: 'Ada Obi',
        image: 'https://cdn.example.com/profile.png',
        speciality: {
          id: specialityIds.cardiology,
          name: 'Directory Cardiology',
        },
        rating: 4.8,
        total_reviews: 3,
        consultation_fee: 5000,
        years_of_experience: 10,
        consultation_type: ConsultationType.BOTH,
        is_available: true,
      });
    });

    it('discloses no private identity, contact, or licensing data', async () => {
      const result = await list({ limit: 50 });
      const serialized = JSON.stringify(result);

      result.items.forEach((item) =>
        expect(Object.keys(item).sort()).toEqual(SUMMARY_FIELDS),
      );
      [
        'private.example.com',
        '+2348000000000',
        '1990-04-12',
        'Privateland',
        'LIC-',
        'stored-password-hash',
        'Private until the detail endpoint',
        ...userIds.values(),
      ].forEach((value) => expect(serialized).not.toContain(value));
    });

    it('reads a page with two parameterized statements and no private column', async () => {
      const term = "Ada' OR 1=1 --";
      statements.length = 0;

      await list({
        q: term,
        speciality_id: specialityIds.cardiology,
        min_fee: 10,
        max_fee: 9000,
        consultation_type: ConsultationType.CHAT,
        limit: 50,
      });

      expect(statements).toHaveLength(2);
      statements.forEach(({ sql, parameters }) => {
        expect(sql).not.toContain(term);
        expect(sql).not.toContain(specialityIds.cardiology);
        expect(parameters).toEqual(
          expect.arrayContaining([specialityIds.cardiology, 10, 9000]),
        );
        expect(sql).not.toMatch(
          /"(email|phone|dob|password|country|license_number|about|google_id|role)"/,
        );
      });
    });

    it('reads a full page with the same two statements', async () => {
      statements.length = 0;

      const result = await list({ limit: 50 });

      expect(result.items).toHaveLength(5);
      expect(statements).toHaveLength(2);
    });
  });
});
