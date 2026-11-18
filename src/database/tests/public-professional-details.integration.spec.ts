import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, Logger, Repository } from 'typeorm';
import { Logger as WinstonLogger } from 'winston';

import {
  Booking,
  BookingStatus,
  ConsultationType as BookingConsultationType,
} from '../../modules/booking/entities/booking.entity';
import { UserPersona } from '../../modules/identity/entities/user-persona.entity';
import { PatientProfile } from '../../modules/patient/entities/patient-profile.entity';
import { ProfessionalAvailability } from '../../modules/professional/entities/professional-availability.entity';
import { ProfessionalPatientNote } from '../../modules/professional/entities/professional-patient-note.entity';
import { ProfessionalReview } from '../../modules/professional/entities/professional-review.entity';
import {
  ConsultationType,
  Professional,
  ProfessionalVerificationStatus,
} from '../../modules/professional/entities/professional.entity';
import { ProfessionalService } from '../../modules/professional/professional.service';
import { PublicProfessionalService } from '../../modules/professional/public-professional.service';
import { PublicProfessionalDirectoryQueryDto } from '../../modules/public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryVisibilityPolicy } from '../../modules/public-discovery/public-discovery-visibility.policy';
import { PublicDiscoveryClock } from '../../modules/public-discovery/public-discovery.clock';
import { PublicResourceNotFoundException } from '../../modules/public-discovery/public-discovery.errors';
import { Speciality } from '../../modules/speciality/entities/speciality.entity';
import { SpecialityService } from '../../modules/speciality/speciality.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

interface ISeed {
  key: string;
  visible: boolean;
  firstName?: string;
  lastName?: string;
  speciality?: 'active' | 'retired';
  professional?: Partial<Professional>;
  user?: Partial<User>;
}

const BIOGRAPHY =
  'Consultant cardiologist with ten years of clinical practice.';

const SEEDS: ISeed[] = [
  {
    key: 'ada',
    visible: true,
    firstName: 'Ada',
    lastName: 'Obi',
    professional: { about: BIOGRAPHY, consultation_fee: 5000 },
  },
  { key: 'unreviewed', visible: true, professional: { about: null } },
  // The stored summary disagrees with the review records on purpose.
  {
    key: 'drifted',
    visible: true,
    professional: { rating: 4.9, total_reviews: 120 },
  },
  {
    key: 'markup',
    visible: true,
    firstName: 'Eve<script>',
    lastName: 'O\u202Eneil\u001B',
    professional: { about: 'Hello <script>alert(1)</script>' },
  },
  {
    key: 'long-biography',
    visible: true,
    professional: { about: 'a'.repeat(4001) },
  },
  {
    key: 'longest-biography',
    visible: true,
    professional: { about: 'a'.repeat(4000) },
  },
  {
    key: 'control-characters',
    visible: true,
    professional: {
      about: '  Line one\r\nLine two\u001B\u202E, BMI > 30 & age < 5  ',
    },
  },
  {
    key: 'stored-image-key',
    visible: true,
    professional: { image: 'professionals/33/avatar.png' },
  },
  {
    key: 'inactive-profile',
    visible: false,
    professional: { is_active: false },
  },
  {
    key: 'pending-review',
    visible: false,
    professional: {
      verification_status: ProfessionalVerificationStatus.PENDING,
    },
  },
  {
    key: 'rejected-review',
    visible: false,
    professional: {
      verification_status: ProfessionalVerificationStatus.REJECTED,
    },
  },
  {
    key: 'pending-account',
    visible: false,
    user: {
      account_status: AccountStatus.PENDING_VERIFICATION,
      email_verified_at: null,
    },
  },
  {
    key: 'suspended-account',
    visible: false,
    user: { account_status: AccountStatus.SUSPENDED },
  },
  {
    key: 'deactivated-account',
    visible: false,
    user: { account_status: AccountStatus.DEACTIVATED },
  },
  { key: 'inactive-speciality', visible: false, speciality: 'retired' },
];

const DETAIL_FIELDS = [
  'about',
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
// PublicProfessionalService against stored professionals in every visibility
// state. Reviews are written through the domain's own review service so the
// published aggregate is compared with records created the canonical way.
integration('Public professional details on real PostgreSQL', () => {
  const policy = new PublicDiscoveryVisibilityPolicy();
  const databaseName = 'details_' + randomUUID().replaceAll('-', '');
  const statements: Array<{ sql: string; parameters: unknown[] }> = [];
  let admin: DataSource;
  let database: DataSource;
  let professionals: Repository<Professional>;
  let reviews: Repository<ProfessionalReview>;
  let bookings: Repository<Booking>;
  let users: Repository<User>;
  let service: PublicProfessionalService;
  let reviewWriter: ProfessionalService;
  const ids = new Map<string, string>();
  const userIds = new Map<string, string>();
  const specialityIds = { active: '', retired: '' };
  let patientSequence = 0;

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

  const createAccount = (label: string, overrides: Partial<User> = {}) => {
    const accountStatus = overrides.account_status ?? AccountStatus.ACTIVE;
    const emailVerifiedAt =
      'email_verified_at' in overrides
        ? overrides.email_verified_at
        : new Date('2026-01-01T00:00:00.000Z');
    // The legacy flags must mirror canonical state or the schema rejects
    // the row (CHK_users_canonical_account_access).
    return users.save(
      users.create({
        email: `${label}@private.example.com`,
        password: 'stored-password-hash',
        first_name: 'Case',
        last_name: label,
        phone: '+2348000000000',
        dob: '1990-04-12',
        country: 'Privateland',
        ...overrides,
        account_status: accountStatus,
        email_verified_at: emailVerifiedAt,
        is_active: accountStatus === AccountStatus.ACTIVE,
        is_verified: emailVerifiedAt instanceof Date,
      }),
    );
  };

  /** A patient completes a consultation and reviews it the canonical way. */
  const reviewThroughDomain = async (key: string, rating: number) => {
    patientSequence += 1;
    const patient = await createAccount(`patient-${patientSequence}`);
    const booking = await bookings.save(
      bookings.create({
        patient_id: patient.id,
        professional_id: idOf(key),
        booking_date: '2026-01-15',
        booking_time: '09:00',
        consultation_type: BookingConsultationType.VIDEO,
        amount: 5000,
        status: BookingStatus.COMPLETED,
        notes: 'Private appointment note',
      }),
    );
    return reviewWriter.createReview(idOf(key), patient.id, {
      rating,
      comment: 'Private review comment',
      booking_id: booking.id,
    });
  };

  const canonicalAggregate = async (key: string) => {
    const [row]: Array<{ rating: string | null; total: string }> =
      await database.query(
        `SELECT ROUND(AVG(rating), 2) AS rating, COUNT(*) AS total
         FROM professional_reviews WHERE professional_id = $1`,
        [idOf(key)],
      );
    return {
      rating: Number(row.rating ?? 0),
      total_reviews: Number(row.total),
    };
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
    reviews = database.getRepository(ProfessionalReview);
    bookings = database.getRepository(Booking);
    users = database.getRepository(User);
    const specialities = database.getRepository(Speciality);
    service = new PublicProfessionalService(
      professionals,
      reviews,
      database.getRepository(ProfessionalAvailability),
      policy,
      new PublicDiscoveryClock(),
    );

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    reviewWriter = new ProfessionalService(
      professionals,
      database.getRepository(ProfessionalAvailability),
      reviews,
      users,
      database.getRepository(UserPersona),
      bookings,
      database.getRepository(PatientProfile),
      database.getRepository(ProfessionalPatientNote),
      new SpecialityService(specialities, policy),
      database,
      { child: () => logger } as unknown as WinstonLogger,
    );

    for (const state of ['active', 'retired'] as const) {
      const saved = await specialities.save(
        specialities.create({
          name: `Details ${state}`,
          is_active: state === 'active',
        }),
      );
      specialityIds[state] = saved.id;
    }

    for (const seed of SEEDS) {
      const user = await createAccount(seed.key, {
        first_name: seed.firstName ?? 'Case',
        last_name: seed.lastName ?? seed.key,
        ...seed.user,
      });
      const professional = await professionals.save(
        professionals.create({
          user_id: user.id,
          speciality_id: specialityIds[seed.speciality ?? 'active'],
          license_number: `LIC-${seed.key}`,
          consultation_fee: 3000,
          years_of_experience: 10,
          consultation_type: ConsultationType.BOTH,
          is_active: true,
          is_available: true,
          verification_status: ProfessionalVerificationStatus.VERIFIED,
          about: 'A public biography',
          image: 'https://cdn.example.com/profile.png',
          ...seed.professional,
        }),
      );
      ids.set(seed.key, professional.id);
      userIds.set(seed.key, user.id);
    }

    for (const rating of [5, 4, 5]) await reviewThroughDomain('ada', rating);

    // Review records that the stored summary of this row does not reflect.
    for (const rating of [3, 4]) {
      const reviewer = await createAccount(`drift-reviewer-${rating}`);
      await reviews.save(
        reviews.create({
          professional_id: idOf('drifted'),
          reviewer_id: reviewer.id,
          rating,
          comment: 'Private review comment',
        }),
      );
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
    it.each(SEEDS.filter((seed) => seed.visible).map((seed) => [seed.key]))(
      'returns the visible %s professional',
      async (key) => {
        await expect(service.findOne(idOf(key))).resolves.toMatchObject({
          id: idOf(key),
        });
      },
    );

    it.each(SEEDS.filter((seed) => !seed.visible).map((seed) => [seed.key]))(
      'reports the %s professional as not found',
      async (key) => {
        await expect(service.findOne(idOf(key))).rejects.toThrow(
          PublicResourceNotFoundException,
        );
      },
    );

    it('reports an unknown identifier as not found', async () => {
      await expect(service.findOne(randomUUID())).rejects.toThrow(
        PublicResourceNotFoundException,
      );
    });

    it('agrees with the in-memory rule for every stored professional', async () => {
      const stored = await professionals.find({
        relations: ['user', 'speciality'],
      });

      expect(stored).toHaveLength(SEEDS.length);
      for (const professional of stored) {
        const found = await service.findOne(professional.id).then(
          () => true,
          () => false,
        );
        expect(found).toBe(policy.isProfessionalVisible(professional));
      }
    });

    it('cannot tell a hidden professional from a missing one', async () => {
      const failure = (id: string) =>
        service.findOne(id).catch((error: PublicResourceNotFoundException) => ({
          status: error.getStatus(),
          body: error.getResponse(),
        }));

      statements.length = 0;
      const hidden = await failure(idOf('suspended-account'));
      const hiddenStatements = statements.map(({ sql }) => sql);

      statements.length = 0;
      const missing = await failure(randomUUID());
      const missingStatements = statements.map(({ sql }) => sql);

      expect(hidden).toEqual(missing);
      expect(hidden).toMatchObject({ status: 404 });
      expect(hiddenStatements).toHaveLength(1);
      expect(hiddenStatements).toEqual(missingStatements);
    });

    it('follows stored state on the next read', async () => {
      const id = idOf('unreviewed');

      await professionals.update(id, { is_active: false });
      await expect(service.findOne(id)).rejects.toThrow(
        PublicResourceNotFoundException,
      );

      await professionals.update(id, { is_active: true });
      await expect(service.findOne(id)).resolves.toMatchObject({ id });
    });
  });

  describe('projection', () => {
    it('publishes exactly the public profile of a stored professional', async () => {
      await expect(service.findOne(idOf('ada'))).resolves.toEqual({
        id: idOf('ada'),
        name: 'Ada Obi',
        image: 'https://cdn.example.com/profile.png',
        speciality: { id: specialityIds.active, name: 'Details active' },
        rating: 4.67,
        total_reviews: 3,
        consultation_fee: 5000,
        years_of_experience: 10,
        consultation_type: ConsultationType.BOTH,
        is_available: true,
        about: BIOGRAPHY,
      });
    });

    it('discloses no private account, licensing, review, or booking data', async () => {
      const detail = await service.findOne(idOf('ada'));
      const serialized = JSON.stringify(detail);
      const reviewRows = await reviews.find({
        where: { professional_id: idOf('ada') },
      });

      expect(Object.keys(detail).sort()).toEqual(DETAIL_FIELDS);
      expect(Object.keys(detail.speciality).sort()).toEqual(['id', 'name']);
      expect(reviewRows).toHaveLength(3);
      [
        'private.example.com',
        '+2348000000000',
        '1990-04-12',
        'Privateland',
        'LIC-',
        'stored-password-hash',
        'Private review comment',
        'Private appointment note',
        ...userIds.values(),
        ...reviewRows.flatMap((review) => [
          review.id,
          review.reviewer_id,
          review.booking_id,
        ]),
      ].forEach((value) => expect(serialized).not.toContain(value));
    });

    it('reads a visible professional with two parameterized statements and no private column', async () => {
      statements.length = 0;

      await service.findOne(idOf('ada'));

      expect(statements).toHaveLength(2);
      statements.forEach(({ sql, parameters }) => {
        expect(sql).not.toContain(idOf('ada'));
        expect(parameters).toContain(idOf('ada'));
        expect(sql).not.toMatch(
          /"(email|phone|dob|password|country|license_number|google_id|role|comment|reviewer_id|booking_id|verification_code|reset_token)"/,
        );
      });
      expect(statements[0].sql).toContain('"about"');
      expect(statements[0].sql).not.toMatch(/"(rating|total_reviews)"/);
      expect(statements[1].sql).toContain('professional_reviews');
    });
  });

  describe('review aggregate', () => {
    it('equals the review records written through the domain service', async () => {
      const detail = await service.findOne(idOf('ada'));

      expect(await canonicalAggregate('ada')).toEqual({
        rating: 4.67,
        total_reviews: 3,
      });
      expect({
        rating: detail.rating,
        total_reviews: detail.total_reviews,
      }).toEqual(await canonicalAggregate('ada'));
    });

    it('agrees with the directory summary the domain service maintains', async () => {
      const detail = await service.findOne(idOf('ada'));
      const directory = await service.findDirectory(
        Object.assign(new PublicProfessionalDirectoryQueryDto(), {
          q: 'Ada Obi',
        }),
      );

      expect(directory.items).toHaveLength(1);
      expect(directory.items[0]).toMatchObject({
        id: idOf('ada'),
        rating: detail.rating,
        total_reviews: detail.total_reviews,
      });
    });

    it('reflects a new review on the next read', async () => {
      await reviewThroughDomain('ada', 1);

      const detail = await service.findOne(idOf('ada'));

      expect(detail).toMatchObject({ rating: 3.75, total_reviews: 4 });
      expect({
        rating: detail.rating,
        total_reviews: detail.total_reviews,
      }).toEqual(await canonicalAggregate('ada'));
    });

    it('reports no rating for a professional without reviews', async () => {
      await expect(service.findOne(idOf('unreviewed'))).resolves.toMatchObject({
        rating: 0,
        total_reviews: 0,
      });
    });

    it('publishes the review records, not a stored summary that drifted', async () => {
      const stored = await professionals.findOneByOrFail({
        id: idOf('drifted'),
      });
      const detail = await service.findOne(idOf('drifted'));

      expect(Number(stored.rating)).toBe(4.9);
      expect(stored.total_reviews).toBe(120);
      expect(detail).toMatchObject({ rating: 3.5, total_reviews: 2 });
    });
  });

  describe('stored text', () => {
    it('withholds a biography that contains markup and neutralizes the name', async () => {
      const detail = await service.findOne(idOf('markup'));

      expect(detail.about).toBeNull();
      expect(detail.name).toBe('Evescript> Oneil');
      expect(JSON.stringify(detail)).not.toMatch(/<[A-Za-z/!?]/);
    });

    it('withholds a biography longer than the published bound', async () => {
      await expect(
        service.findOne(idOf('long-biography')),
      ).resolves.toMatchObject({ about: null });
    });

    it('publishes a biography at the published bound', async () => {
      const detail = await service.findOne(idOf('longest-biography'));

      expect(detail.about).toHaveLength(4000);
    });

    it('removes control characters and keeps harmless comparison signs', async () => {
      await expect(
        service.findOne(idOf('control-characters')),
      ).resolves.toMatchObject({
        about: 'Line one\nLine two, BMI > 30 & age < 5',
      });
    });

    it('withholds an image that is a storage key', async () => {
      await expect(
        service.findOne(idOf('stored-image-key')),
      ).resolves.toMatchObject({ image: null });
    });
  });
});
