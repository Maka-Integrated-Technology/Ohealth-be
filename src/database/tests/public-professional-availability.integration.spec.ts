import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, Logger, Repository } from 'typeorm';
import { Logger as WinstonLogger } from 'winston';

import { BookingService } from '../../modules/booking/booking.service';
import { ConsultationType as BookingRequestType } from '../../modules/booking/dto/create-booking.dto';
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
import { PLATFORM_SCHEDULING_TIME_ZONE } from '../../modules/professional/professional-availability.constants';
import { ProfessionalService } from '../../modules/professional/professional.service';
import {
  PUBLIC_AVAILABILITY_RANGE_OVER_MESSAGE,
  PublicProfessionalService,
} from '../../modules/professional/public-professional.service';
import {
  PublicAvailabilityQueryDto,
  PublicDateRangeQueryDto,
} from '../../modules/public-discovery/dto/public-discovery-query.dto';
import { PublicProfessionalAvailabilityDto } from '../../modules/public-discovery/dto/public-discovery-response.dto';
import { PublicDiscoveryVisibilityPolicy } from '../../modules/public-discovery/public-discovery-visibility.policy';
import { PublicDiscoveryClock } from '../../modules/public-discovery/public-discovery.clock';
import { PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS } from '../../modules/public-discovery/public-discovery.constants';
import {
  PublicQueryRejectedException,
  PublicResourceNotFoundException,
} from '../../modules/public-discovery/public-discovery.errors';
import { Speciality } from '../../modules/speciality/entities/speciality.entity';
import { SpecialityService } from '../../modules/speciality/speciality.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

interface ISeed {
  key: string;
  visible: boolean;
  speciality?: 'active' | 'retired';
  professional?: Partial<Professional>;
  user?: Partial<User>;
}

const SEEDS: ISeed[] = [
  { key: 'open', visible: true },
  { key: 'other', visible: true },
  { key: 'empty', visible: true },
  { key: 'timeline', visible: true },
  { key: 'zones', visible: true },
  { key: 'busy', visible: true },
  { key: 'contested', visible: true },
  { key: 'crowded', visible: true },
  // Not taking consultations, but still discoverable.
  { key: 'paused', visible: true, professional: { is_available: false } },
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

const SLOT_FIELDS = [
  'end_time',
  'ends_at',
  'id',
  'start_time',
  'starts_at',
  'time_zone',
];

const DAY = 24 * 60 * 60 * 1000;

/** Calendar date `offset` days after today, far enough ahead in any zone. */
const day = (offset: number): string =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

// Runs every migration into a disposable database, then drives the real
// PublicProfessionalService against stored slots and bookings. Slots are
// offered, booked, accepted, rejected, and cancelled through the domain's own
// services, so the published availability is compared with state created the
// canonical way.
integration('Public professional availability on real PostgreSQL', () => {
  const policy = new PublicDiscoveryVisibilityPolicy();
  const databaseName = 'availability_' + randomUUID().replaceAll('-', '');
  const statements: Array<{ sql: string; parameters: unknown[] }> = [];
  let admin: DataSource;
  let database: DataSource;
  let databaseUrl: string;
  let professionals: Repository<Professional>;
  let slots: Repository<ProfessionalAvailability>;
  let bookings: Repository<Booking>;
  let users: Repository<User>;
  let service: PublicProfessionalService;
  let schedule: ProfessionalService;
  let booking: BookingService;
  const ids = new Map<string, string>();
  const userIds = new Map<string, string>();
  const specialityIds = { active: '', retired: '' };
  let accountSequence = 0;
  let daySequence = 2;

  // The instant public discovery reads as "now". Real time unless a test
  // fixes it.
  let currentInstant: () => Date = () => new Date();
  const clock: PublicDiscoveryClock = { now: () => currentInstant() };
  const at = (instant: string): void => {
    currentInstant = () => new Date(instant);
  };

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

  /** A date no other test offers slots on. */
  const nextDay = (): string => {
    daySequence += 1;
    return day(daySequence);
  };

  const range = (from: string, to: string = from): PublicDateRangeQueryDto =>
    Object.assign(new PublicDateRangeQueryDto(), { from, to });

  const read = (
    key: string,
    from: string,
    to: string = from,
    reader: PublicProfessionalService = service,
    cursor?: string,
  ): Promise<PublicProfessionalAvailabilityDto> =>
    reader.findAvailability(
      idOf(key),
      Object.assign(new PublicAvailabilityQueryDto(), {
        ...range(from, to),
        ...(cursor ? { cursor } : {}),
      }),
    );

  /** Every page of a range, following next_cursor to the end. */
  const readAllPages = async (key: string, from: string, to: string) => {
    const pages: PublicProfessionalAvailabilityDto[] = [];
    let cursor: string | undefined;
    do {
      const page = await read(key, from, to, service, cursor);
      pages.push(page);
      cursor = page.next_cursor ?? undefined;
      expect(page.has_more).toBe(page.next_cursor !== null);
    } while (cursor && pages.length < 20);
    return pages;
  };

  const flatten = (availability: PublicProfessionalAvailabilityDto) =>
    availability.days.flatMap((published) =>
      published.slots.map((slot) => ({ date: published.date, ...slot })),
    );

  const slotIds = (availability: PublicProfessionalAvailabilityDto) =>
    flatten(availability).map((slot) => slot.id);

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

  const createPatient = async (): Promise<string> => {
    accountSequence += 1;
    return (await createAccount(`patient-${accountSequence}`)).id;
  };

  /** The professional offers slots through the schedule write path. */
  const offer = async (
    key: string,
    date: string,
    ...times: Array<[start: string, end: string]>
  ): Promise<string[]> => {
    const created = await schedule.createAvailabilities(idOf(key), {
      slots: times.map(([start, end]) => ({
        date,
        start_time: start,
        end_time: end,
      })),
    });
    return created.map((slot) => slot.id);
  };

  /** A stored slot in any zone, for cases the write path cannot produce. */
  const store = async (
    key: string,
    date: string,
    start: string,
    end: string,
    overrides: Partial<ProfessionalAvailability> = {},
  ): Promise<string> => {
    const saved = await slots.save(
      slots.create({
        professional_id: idOf(key),
        date,
        start_time: start,
        end_time: end,
        is_available: true,
        ...overrides,
      }),
    );
    return saved.id;
  };

  /** A patient books a listed slot through the booking service. */
  const book = async (key: string, date: string, time: string) =>
    booking.create(await createPatient(), {
      professional_id: idOf(key),
      booking_date: date,
      booking_time: time,
      consultation_type: BookingRequestType.VIDEO,
      notes: 'Private appointment note',
    });

  /** A booking stored before slots were linked: it names no slot. */
  const storeUnlinkedBooking = async (
    key: string,
    date: string,
    time: string,
    status: BookingStatus,
  ): Promise<Booking> =>
    bookings.save(
      bookings.create({
        patient_id: await createPatient(),
        professional_id: idOf(key),
        booking_date: date,
        booking_time: time,
        consultation_type: BookingConsultationType.VIDEO,
        amount: 3000,
        status,
        notes: 'Private appointment note',
        payment_reference: 'PAY-PRIVATE-REFERENCE',
      }),
    );

  const createService = (source: DataSource): PublicProfessionalService =>
    new PublicProfessionalService(
      source.getRepository(Professional),
      source.getRepository(ProfessionalReview),
      source.getRepository(ProfessionalAvailability),
      policy,
      clock,
    );

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${databaseName}"`);

    const url = new URL(env.PG_INTEGRATION_URL);
    url.pathname = '/' + databaseName;
    databaseUrl = url.toString();
    database = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      migrations: [__dirname + '/../migrations/*.ts'],
      synchronize: false,
      logging: ['query'],
      logger: recorder,
    });
    await database.initialize();
    await database.runMigrations();

    professionals = database.getRepository(Professional);
    slots = database.getRepository(ProfessionalAvailability);
    bookings = database.getRepository(Booking);
    users = database.getRepository(User);
    const specialities = database.getRepository(Speciality);
    service = createService(database);

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const winston = { child: () => logger } as unknown as WinstonLogger;
    schedule = new ProfessionalService(
      professionals,
      slots,
      database.getRepository(ProfessionalReview),
      users,
      database.getRepository(UserPersona),
      bookings,
      database.getRepository(PatientProfile),
      database.getRepository(ProfessionalPatientNote),
      new SpecialityService(specialities, policy),
      database,
      winston,
    );
    booking = new BookingService(
      bookings,
      professionals,
      slots,
      database,
      winston,
    );

    for (const state of ['active', 'retired'] as const) {
      const saved = await specialities.save(
        specialities.create({
          name: `Availability ${state}`,
          is_active: state === 'active',
        }),
      );
      specialityIds[state] = saved.id;
    }

    for (const seed of SEEDS) {
      const user = await createAccount(seed.key, seed.user);
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
          ...seed.professional,
        }),
      );
      ids.set(seed.key, professional.id);
      userIds.set(seed.key, user.id);
    }

    // Every professional, discoverable or not, has an open future slot.
    for (const seed of SEEDS.filter(({ key }) => key !== 'empty')) {
      await store(seed.key, day(2), '09:00', '09:30');
    }
  }, 120_000);

  afterEach(() => {
    currentInstant = () => new Date();
  });

  // Dropping a database waits for its background workers to leave, which can
  // take longer than the default hook timeout after bulk writes.
  afterAll(async () => {
    await database?.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  }, 60_000);

  describe('visibility', () => {
    it.each(
      SEEDS.filter((seed) => seed.visible && seed.key !== 'empty').map(
        (seed) => [seed.key],
      ),
    )('returns the open slot of the visible %s professional', async (key) => {
      const availability = await read(key, day(2));

      expect(flatten(availability)).toHaveLength(1);
      expect(flatten(availability)[0]).toMatchObject({
        date: day(2),
        start_time: '09:00:00',
      });
    });

    it.each(SEEDS.filter((seed) => !seed.visible).map((seed) => [seed.key]))(
      'reports the %s professional as not found although it has an open slot',
      async (key) => {
        const stored = await slots.countBy({ professional_id: idOf(key) });

        expect(stored).toBe(1);
        await expect(read(key, day(2))).rejects.toThrow(
          PublicResourceNotFoundException,
        );
      },
    );

    it('reports an unknown identifier as not found', async () => {
      await expect(
        service.findAvailability(randomUUID(), range(day(2))),
      ).rejects.toThrow(PublicResourceNotFoundException);
    });

    it('agrees with the in-memory rule for every stored professional', async () => {
      const stored = await professionals.find({
        relations: ['user', 'speciality'],
      });

      expect(stored).toHaveLength(SEEDS.length);
      for (const professional of stored) {
        const found = await service
          .findAvailability(professional.id, range(day(2)))
          .then(
            () => true,
            () => false,
          );
        expect(found).toBe(policy.isProfessionalVisible(professional));
      }
    });

    it('cannot tell a hidden professional from a missing one', async () => {
      const failure = (id: string) =>
        service
          .findAvailability(id, range(day(2)))
          .catch((error: PublicResourceNotFoundException) => ({
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
      expect(hiddenStatements[0]).not.toContain('professional_availabilities');
    });

    it('refuses a past range before reading, whoever is asked about', async () => {
      const refusal = async (id: string) => {
        statements.length = 0;
        const error = await service
          .findAvailability(id, range('2020-01-01', '2020-01-31'))
          .then(
            () => null,
            (caught: PublicQueryRejectedException) => caught,
          );
        return {
          status: error?.getStatus(),
          body: error?.getResponse(),
          statements: statements.length,
        };
      };

      const visible = await refusal(idOf('open'));

      expect(visible).toEqual({
        status: 400,
        body: {
          message: [PUBLIC_AVAILABILITY_RANGE_OVER_MESSAGE],
          error: 'Bad Request',
          statusCode: 400,
        },
        statements: 0,
      });
      expect(await refusal(idOf('suspended-account'))).toEqual(visible);
      expect(await refusal(randomUUID())).toEqual(visible);
    });

    it('follows stored state on the next read', async () => {
      const id = idOf('empty');

      await professionals.update(id, { is_active: false });
      await expect(read('empty', day(2))).rejects.toThrow(
        PublicResourceNotFoundException,
      );

      await professionals.update(id, { is_active: true });
      await expect(read('empty', day(2))).resolves.toMatchObject({ days: [] });
    });

    it('lists the slots of a professional who is not taking consultations', async () => {
      // Booking creation does not read that flag, so the slots are bookable.
      const stored = await professionals.findOneByOrFail({
        id: idOf('paused'),
      });

      expect(stored.is_available).toBe(false);
      expect(slotIds(await read('paused', day(2)))).toHaveLength(1);
    });
  });

  describe('projection', () => {
    it('publishes exactly the public form of a stored slot', async () => {
      const date = '2031-06-02';
      const [first, second] = await offer(
        'open',
        date,
        ['09:00', '09:30'],
        ['14:15', '15:00'],
      );
      at('2031-06-01T10:30:00.000Z');

      await expect(read('open', '2031-06-01', '2031-06-07')).resolves.toEqual({
        from: '2031-06-01',
        to: '2031-06-07',
        as_of: '2031-06-01T10:30:00.000Z',
        days: [
          {
            date,
            slots: [
              {
                id: first,
                start_time: '09:00:00',
                end_time: '09:30:00',
                time_zone: 'Africa/Lagos',
                starts_at: '2031-06-02T08:00:00.000Z',
                ends_at: '2031-06-02T08:30:00.000Z',
              },
              {
                id: second,
                start_time: '14:15:00',
                end_time: '15:00:00',
                time_zone: 'Africa/Lagos',
                starts_at: '2031-06-02T13:15:00.000Z',
                ends_at: '2031-06-02T14:00:00.000Z',
              },
            ],
          },
        ],
        has_more: false,
        next_cursor: null,
      });
    });

    it('records the platform scheduling zone on a slot offered through the write path', async () => {
      const [id] = await offer('open', '2031-06-03', ['09:00', '09:30']);

      await expect(slots.findOneByOrFail({ id })).resolves.toMatchObject({
        time_zone: PLATFORM_SCHEDULING_TIME_ZONE,
      });
    });

    it('discloses no patient, booking, payment, or ownership data', async () => {
      const date = nextDay();
      const [free, taken, restored] = await offer(
        'open',
        date,
        ['09:00', '09:30'],
        ['10:00', '10:30'],
        ['11:00', '11:30'],
      );
      const active = await book('open', date, '10:00');
      const cancelled = await book('open', date, '11:00');
      await booking.cancelBooking(cancelled.id, cancelled.patient_id);
      const unlinked = await storeUnlinkedBooking(
        'open',
        date,
        '12:00',
        BookingStatus.CONFIRMED,
      );

      const availability = await read('open', date);
      const serialized = JSON.stringify(availability);

      expect(slotIds(availability)).toEqual([free, restored]);
      expect(slotIds(availability)).not.toContain(taken);
      expect(Object.keys(availability).sort()).toEqual([
        'as_of',
        'days',
        'from',
        'has_more',
        'next_cursor',
        'to',
      ]);
      availability.days.forEach((published) => {
        expect(Object.keys(published).sort()).toEqual(['date', 'slots']);
        published.slots.forEach((slot) =>
          expect(Object.keys(slot).sort()).toEqual(SLOT_FIELDS),
        );
      });
      [
        active.id,
        active.patient_id,
        cancelled.id,
        cancelled.patient_id,
        unlinked.id,
        unlinked.patient_id,
        idOf('open'),
        userIds.get('open'),
        'Private appointment note',
        'PAY-PRIVATE-REFERENCE',
        'private.example.com',
        'pending',
        'confirmed',
        'cancelled',
        'is_available',
        'professional_id',
        'patient',
        'amount',
        '3000',
      ].forEach((value) => expect(serialized).not.toContain(value));
    });

    it('reads a visible professional with two parameterized statements and selects no booking column', async () => {
      const date = nextDay();
      await offer('open', date, ['09:00', '09:30'], ['10:00', '10:30']);
      await book('open', date, '10:00');
      statements.length = 0;

      await read('open', date);

      expect(statements).toHaveLength(2);
      statements.forEach(({ sql, parameters }) => {
        expect(sql).toMatch(/^SELECT /);
        expect(sql).not.toContain(idOf('open'));
        expect(sql).not.toContain(date);
        expect(parameters).toContain(idOf('open'));
        expect(sql).not.toMatch(/FOR (UPDATE|SHARE|NO KEY UPDATE|KEY SHARE)/);
        expect(sql).not.toMatch(
          /"(email|phone|dob|password|country|license_number|patient_id|notes|payment_reference|amount|is_paid)"/,
        );
      });

      const [visibility, open] = statements;
      const selected = open.sql.slice(0, open.sql.indexOf(' FROM '));
      expect(visibility.sql).not.toContain('professional_availabilities');
      expect(open.sql).toContain('professional_availabilities');
      expect(open.parameters).toEqual(
        expect.arrayContaining([date, true, BookingStatus.CANCELLED]),
      );
      expect(selected).not.toMatch(/occupying|bookings|professional_id/);
      expect(selected).not.toMatch(/"is_available"|created_at|updated_at/);
    });
  });

  describe('occupancy', () => {
    const openOn = async (date: string) => slotIds(await read('open', date));

    it('hides a slot while a booking holds it and returns it when the patient cancels', async () => {
      const date = nextDay();
      const [slot, untouched] = await offer(
        'open',
        date,
        ['09:00', '09:30'],
        ['10:00', '10:30'],
      );
      expect(await openOn(date)).toEqual([slot, untouched]);

      const pending = await book('open', date, '09:00');
      expect(pending.status).toBe(BookingStatus.PENDING);
      expect(await openOn(date)).toEqual([untouched]);

      await schedule.acceptMyBooking(userIds.get('open'), pending.id);
      expect(await openOn(date)).toEqual([untouched]);

      await bookings.update(pending.id, { status: BookingStatus.COMPLETED });
      expect(await openOn(date)).toEqual([untouched]);

      await bookings.update(pending.id, { status: BookingStatus.CONFIRMED });
      await booking.cancelBooking(pending.id, pending.patient_id);
      expect(await openOn(date)).toEqual([slot, untouched]);
    });

    it('returns a slot when the professional rejects its booking', async () => {
      const date = nextDay();
      const [slot] = await offer('open', date, ['09:00', '09:30']);
      const pending = await book('open', date, '09:00');
      expect(await openOn(date)).toEqual([]);

      await schedule.rejectMyBooking(userIds.get('open'), pending.id);

      expect(await openOn(date)).toEqual([slot]);
    });

    it.each([
      [BookingStatus.PENDING],
      [BookingStatus.CONFIRMED],
      [BookingStatus.COMPLETED],
    ])(
      'hides a slot flagged available that a %s booking still names',
      async (status) => {
        const date = nextDay();
        const [slot] = await offer('open', date, ['09:00', '09:30']);
        const held = await book('open', date, '09:00');
        // The flag and the booking disagree; the booking decides.
        await slots.update(slot, { is_available: true });
        await bookings.update(held.id, { status });

        expect(await openOn(date)).toEqual([]);
      },
    );

    it.each([
      [BookingStatus.PENDING, false],
      [BookingStatus.CONFIRMED, false],
      [BookingStatus.COMPLETED, false],
      [BookingStatus.CANCELLED, true],
    ])(
      'treats a %s booking that names no slot as occupying its date and time',
      async (status, listed) => {
        const date = nextDay();
        const [slot] = await offer('open', date, ['09:00', '09:30']);
        await storeUnlinkedBooking('open', date, '09:00', status);

        expect(await openOn(date)).toEqual(listed ? [slot] : []);
      },
    );

    it('hides a slot the professional withdrew without any booking', async () => {
      const date = nextDay();
      const [withdrawn, offered] = await offer(
        'open',
        date,
        ['09:00', '09:30'],
        ['10:00', '10:30'],
      );
      await slots.update(withdrawn, { is_available: false });

      expect(await openOn(date)).toEqual([offered]);
    });

    it('is not affected by bookings of another professional or another time', async () => {
      const date = nextDay();
      const [slot] = await offer('open', date, ['09:00', '09:30']);
      await offer('other', date, ['09:00', '09:30']);
      await book('other', date, '09:00');
      await storeUnlinkedBooking(
        'other',
        date,
        '09:00',
        BookingStatus.CONFIRMED,
      );
      await storeUnlinkedBooking(
        'open',
        date,
        '09:30',
        BookingStatus.CONFIRMED,
      );
      await storeUnlinkedBooking(
        'open',
        day(400),
        '09:00',
        BookingStatus.CONFIRMED,
      );

      expect(await openOn(date)).toEqual([slot]);
      expect(slotIds(await read('other', date))).toEqual([]);
    });

    it('never lists the slots of another professional', async () => {
      const date = nextDay();
      const mine = await offer('open', date, ['09:00', '09:30']);
      const theirs = await offer('other', date, ['10:00', '10:30']);

      expect(await openOn(date)).toEqual(mine);
      expect(slotIds(await read('other', date))).toEqual(theirs);
    });

    it('equals the open slots derived independently from the stored rows', async () => {
      const from = nextDay();
      const to = nextDay();
      for (const date of [from, to]) {
        await offer(
          'open',
          date,
          ['08:00', '08:30'],
          ['09:00', '09:30'],
          ['10:00', '10:30'],
          ['11:00', '11:30'],
          ['12:00', '12:30'],
        );
      }
      await book('open', from, '08:00');
      const cancelled = await book('open', from, '09:00');
      await booking.cancelBooking(cancelled.id, cancelled.patient_id);
      await storeUnlinkedBooking('open', from, '10:00', BookingStatus.PENDING);
      await storeUnlinkedBooking('open', to, '11:00', BookingStatus.CANCELLED);
      const withdrawn = await slots.findOneByOrFail({
        professional_id: idOf('open'),
        date: to,
        start_time: '12:00',
      });
      await slots.update(withdrawn.id, { is_available: false });

      const storedSlots = await slots.find({
        where: { professional_id: idOf('open') },
      });
      const storedBookings = await bookings.find({
        where: { professional_id: idOf('open') },
      });
      const occupied = (slot: ProfessionalAvailability) =>
        storedBookings.some(
          (candidate) =>
            candidate.status !== BookingStatus.CANCELLED &&
            (candidate.availability_id === slot.id ||
              (candidate.booking_date === slot.date &&
                candidate.booking_time === slot.start_time)),
        );
      const expected = storedSlots
        .filter(
          (slot) =>
            [from, to].includes(slot.date) &&
            slot.is_available &&
            !occupied(slot),
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.start_time.localeCompare(b.start_time),
        )
        .map((slot) => slot.id);

      // Of ten slots: one booked, one held by an unlinked booking, and one
      // withdrawn are left out.
      expect(expected).toHaveLength(7);
      expect(slotIds(await read('open', from, to))).toEqual(expected);
    });
  });

  describe('time boundaries', () => {
    it('lists a slot until the instant it starts', async () => {
      // 09:00 in Lagos is 08:00 UTC.
      const [slot] = await offer('timeline', '2031-03-11', ['09:00', '09:30']);
      const listedAt = async (instant: string) => {
        at(instant);
        return slotIds(await read('timeline', '2031-03-11'));
      };

      expect(await listedAt('2031-03-11T07:59:59.999Z')).toEqual([slot]);
      expect(await listedAt('2031-03-11T08:00:00.000Z')).toEqual([]);
      expect(await listedAt('2031-03-11T08:00:00.001Z')).toEqual([]);
      expect(await listedAt('2031-03-11T08:15:00.000Z')).toEqual([]);
    });

    it('returns only the future slots of a range that began in the past', async () => {
      await offer('timeline', '2031-04-01', ['09:00', '09:30']);
      const [later] = await offer('timeline', '2031-04-01', ['15:00', '15:30']);
      const [tomorrow] = await offer('timeline', '2031-04-02', [
        '09:00',
        '09:30',
      ]);
      at('2031-04-01T12:00:00.000Z');

      const availability = await read('timeline', '2031-03-20', '2031-04-02');

      expect(slotIds(availability)).toEqual([later, tomorrow]);
      flatten(availability).forEach((slot) =>
        expect(new Date(slot.starts_at).getTime()).toBeGreaterThan(
          new Date(availability.as_of).getTime(),
        ),
      );
    });

    it('includes both ends of the date range and nothing outside it', async () => {
      const stored = new Map<string, string>();
      for (const date of [
        '2031-07-09',
        '2031-07-10',
        '2031-07-12',
        '2031-07-14',
        '2031-07-15',
      ]) {
        const [id] = await offer('timeline', date, ['09:00', '09:30']);
        stored.set(date, id);
      }
      at('2031-07-01T00:00:00.000Z');

      const availability = await read('timeline', '2031-07-10', '2031-07-14');

      expect(availability.days.map((published) => published.date)).toEqual([
        '2031-07-10',
        '2031-07-12',
        '2031-07-14',
      ]);
      expect(slotIds(availability)).toEqual([
        stored.get('2031-07-10'),
        stored.get('2031-07-12'),
        stored.get('2031-07-14'),
      ]);
    });

    it('accepts the longest range and reads every day of it', async () => {
      const first = await offer('timeline', '2031-08-01', ['09:00', '09:30']);
      const last = await offer('timeline', '2031-08-31', ['09:00', '09:30']);
      at('2031-07-01T00:00:00.000Z');

      expect(
        slotIds(await read('timeline', '2031-08-01', '2031-08-31')),
      ).toEqual([...first, ...last]);
    });

    it('resolves each slot in its own stored zone', async () => {
      // Earlier on the clock in New York, yet later as an instant.
      const newYork = await store('zones', '2031-03-12', '08:00', '08:30', {
        time_zone: 'America/New_York',
      });
      const lagos = await store('zones', '2031-03-12', '09:00', '09:30');
      at('2031-03-12T00:00:00.000Z');

      expect(flatten(await read('zones', '2031-03-12'))).toEqual([
        {
          date: '2031-03-12',
          id: lagos,
          start_time: '09:00:00',
          end_time: '09:30:00',
          time_zone: 'Africa/Lagos',
          starts_at: '2031-03-12T08:00:00.000Z',
          ends_at: '2031-03-12T08:30:00.000Z',
        },
        {
          date: '2031-03-12',
          id: newYork,
          start_time: '08:00:00',
          end_time: '08:30:00',
          time_zone: 'America/New_York',
          starts_at: '2031-03-12T12:00:00.000Z',
          ends_at: '2031-03-12T12:30:00.000Z',
        },
      ]);

      // Between the two instants only the New York slot is still ahead.
      at('2031-03-12T10:00:00.000Z');
      expect(slotIds(await read('zones', '2031-03-12'))).toEqual([newYork]);
    });

    it('applies the daylight saving rules of the stored zone', async () => {
      // New York moves its clocks forward on 9 March 2031.
      const before = await store('zones', '2031-03-08', '09:00', '09:30', {
        time_zone: 'America/New_York',
      });
      const after = await store('zones', '2031-03-10', '09:00', '09:30', {
        time_zone: 'America/New_York',
      });
      at('2031-03-01T00:00:00.000Z');

      const published = flatten(
        await read('zones', '2031-03-08', '2031-03-10'),
      );

      expect(published.map((slot) => [slot.id, slot.starts_at])).toEqual([
        [before, '2031-03-08T14:00:00.000Z'],
        [after, '2031-03-10T13:00:00.000Z'],
      ]);
    });

    it('matches the date range against the local date of the slot', async () => {
      // 00:30 on the 20th in Kiritimati is still the 19th in UTC, and 23:00
      // on the 19th twelve hours behind UTC is already the 20th in UTC.
      const ahead = await store('zones', '2031-05-20', '00:30', '01:00', {
        time_zone: 'Pacific/Kiritimati',
      });
      const behind = await store('zones', '2031-05-19', '23:00', '23:30', {
        time_zone: 'Etc/GMT+12',
      });
      at('2031-05-01T00:00:00.000Z');

      expect(flatten(await read('zones', '2031-05-20'))).toEqual([
        expect.objectContaining({
          id: ahead,
          date: '2031-05-20',
          starts_at: '2031-05-19T10:30:00.000Z',
        }),
      ]);
      expect(flatten(await read('zones', '2031-05-19'))).toEqual([
        expect.objectContaining({
          id: behind,
          date: '2031-05-19',
          starts_at: '2031-05-20T11:00:00.000Z',
        }),
      ]);
    });

    it('orders the days of a response by local date when zones interleave', async () => {
      // The Kiritimati slot starts first as an instant but on a later date.
      const ahead = await store('zones', '2031-05-27', '00:30', '01:00', {
        time_zone: 'Pacific/Kiritimati',
      });
      const behind = await store('zones', '2031-05-26', '23:00', '23:30', {
        time_zone: 'Etc/GMT+12',
      });
      at('2031-05-01T00:00:00.000Z');

      const availability = await read('zones', '2031-05-26', '2031-05-27');

      expect(
        availability.days.map((day) => [
          day.date,
          day.slots.map((slot) => slot.id),
        ]),
      ).toEqual([
        ['2031-05-26', [behind]],
        ['2031-05-27', [ahead]],
      ]);
    });

    it('reads a range whose last day is still current somewhere, and refuses it once it is over everywhere', async () => {
      const slot = await store('zones', '2031-09-10', '23:00', '23:30', {
        time_zone: 'Etc/GMT+12',
      });

      // The 10th has ended in Lagos but not twelve hours behind UTC, where
      // this slot has yet to start.
      at('2031-09-11T10:00:00.000Z');
      expect(slotIds(await read('zones', '2031-09-10'))).toEqual([slot]);

      at('2031-09-11T11:59:59.999Z');
      expect(slotIds(await read('zones', '2031-09-10'))).toEqual([]);

      at('2031-09-11T12:00:00.000Z');
      await expect(read('zones', '2031-09-10')).rejects.toThrow(
        PublicQueryRejectedException,
      );
    });

    it('ends a slot on the following day when its end time is not after its start', async () => {
      const overnight = await store('timeline', '2031-10-05', '23:30', '00:15');
      const untilMidnight = await store(
        'timeline',
        '2031-10-06',
        '23:00',
        '24:00',
      );
      await store('timeline', '2031-10-07', '12:00', '12:00');
      at('2031-10-01T00:00:00.000Z');

      expect(
        flatten(await read('timeline', '2031-10-05', '2031-10-07')),
      ).toEqual([
        {
          date: '2031-10-05',
          id: overnight,
          start_time: '23:30:00',
          end_time: '00:15:00',
          time_zone: 'Africa/Lagos',
          starts_at: '2031-10-05T22:30:00.000Z',
          ends_at: '2031-10-05T23:15:00.000Z',
        },
        {
          date: '2031-10-06',
          id: untilMidnight,
          start_time: '23:00:00',
          end_time: '24:00:00',
          time_zone: 'Africa/Lagos',
          starts_at: '2031-10-06T22:00:00.000Z',
          ends_at: '2031-10-06T23:00:00.000Z',
        },
      ]);
    });

    it('gives the same answer whatever zone the database session and the server run in', async () => {
      await store('zones', '2031-11-04', '09:00', '09:30');
      await store('zones', '2031-11-04', '08:00', '08:30', {
        time_zone: 'America/New_York',
      });
      at('2031-11-04T07:30:00.000Z');
      const expected = await read('zones', '2031-11-03', '2031-11-05');

      const elsewhere = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        entities: [__dirname + '/../../modules/**/*.entity.ts'],
        synchronize: false,
        extra: { options: '-c TimeZone=Pacific/Kiritimati' },
      });
      await elsewhere.initialize();
      const originalZone = env.TZ;
      try {
        const [{ zone }]: Array<{ zone: string }> = await elsewhere.query(
          `SELECT current_setting('TimeZone') AS zone`,
        );
        expect(zone).toBe('Pacific/Kiritimati');

        const answers = [];
        for (const serverZone of ['Pacific/Kiritimati', 'Etc/GMT+12']) {
          env.TZ = serverZone;
          answers.push(
            await read(
              'zones',
              '2031-11-03',
              '2031-11-05',
              createService(elsewhere),
            ),
            await read('zones', '2031-11-03', '2031-11-05'),
          );
        }

        expect(flatten(expected)).toHaveLength(2);
        answers.forEach((answer) => expect(answer).toEqual(expected));
      } finally {
        if (originalZone === undefined) delete env.TZ;
        else env.TZ = originalZone;
        await elsewhere.destroy();
      }
    });
  });

  describe('order and bound', () => {
    const BUSY_DAYS = 5;
    const SLOTS_PER_DAY = 101;

    beforeAll(async () => {
      // 505 five-minute slots across five days, inserted in no useful order.
      await database.query(
        `INSERT INTO professional_availabilities
           (professional_id, date, start_time, end_time)
         SELECT $1, d::date, t, t + interval '5 minutes'
         FROM generate_series('2031-12-01'::date, '2031-12-05'::date, '1 day') AS d,
              (SELECT time '06:00' + n * interval '5 minutes' AS t
               FROM generate_series(0, $2 - 1) AS n) AS times
         ORDER BY random()`,
        [idOf('busy'), SLOTS_PER_DAY],
      );
    });

    it('orders slots chronologically across days and reads the same every time', async () => {
      at('2031-11-01T00:00:00.000Z');

      const first = await read('busy', '2031-12-01', '2031-12-02');
      const second = await read('busy', '2031-12-01', '2031-12-02');
      const instants = flatten(first).map((slot) => slot.starts_at);

      expect(second).toEqual(first);
      expect(first.has_more).toBe(false);
      expect(first.days.map((published) => published.date)).toEqual([
        '2031-12-01',
        '2031-12-02',
      ]);
      expect(instants).toHaveLength(2 * SLOTS_PER_DAY);
      expect(instants).toEqual([...instants].sort());
      expect(new Set(instants).size).toBe(instants.length);
    });

    it('returns at most the bounded number of slots and says that more exist', async () => {
      at('2031-11-01T00:00:00.000Z');
      const stored: Array<{ id: string }> = await database.query(
        `SELECT id FROM professional_availabilities
         WHERE professional_id = $1 AND date BETWEEN '2031-12-01' AND '2031-12-05'
         ORDER BY date, start_time`,
        [idOf('busy')],
      );

      const availability = await read('busy', '2031-12-01', '2031-12-05');

      expect(stored).toHaveLength(BUSY_DAYS * SLOTS_PER_DAY);
      expect(availability.has_more).toBe(true);
      expect(slotIds(availability)).toEqual(
        stored
          .slice(0, PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS)
          .map((slot) => slot.id),
      );
    });

    it('reads the rest of the range by following next_cursor', async () => {
      at('2031-11-01T00:00:00.000Z');

      const pages = await readAllPages('busy', '2031-12-01', '2031-12-05');
      const ids = pages.flatMap(slotIds);

      expect(pages.map((page) => slotIds(page).length)).toEqual([500, 5]);
      expect(pages[1].next_cursor).toBeNull();
      expect(new Set(ids).size).toBe(BUSY_DAYS * SLOTS_PER_DAY);
      expect(ids).toHaveLength(BUSY_DAYS * SLOTS_PER_DAY);
    });

    it('reports nothing left out when the slots exactly fill the bound', async () => {
      // Five slots have started, leaving exactly the bound.
      at('2031-12-01T05:20:00.001Z');

      const availability = await read('busy', '2031-12-01', '2031-12-05');

      expect(slotIds(availability)).toHaveLength(
        PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS,
      );
      expect(availability.has_more).toBe(false);
    });

    it('pages through more than one response of slots on a single date', async () => {
      // 1,203 slots on one date: 1,200 one-minute slots in Lagos, and three in
      // other zones starting at the same instants as Lagos slots, so pages
      // split inside one date and between equal instants.
      await database.query(
        `INSERT INTO professional_availabilities
           (professional_id, date, start_time, end_time)
         SELECT $1, '2031-12-20', time '01:00' + n * interval '1 minute',
                time '01:01' + n * interval '1 minute'
         FROM generate_series(0, 1199) AS n
         ORDER BY random()`,
        [idOf('crowded')],
      );
      // Cairo is one hour and Moscow two hours ahead of Lagos in December, so
      // these start at the same instants as the Lagos 20:00, 20:30, and 20:59
      // slots, at wall-clock times no Lagos slot uses.
      await database.query(
        `INSERT INTO professional_availabilities
           (professional_id, date, start_time, end_time, time_zone)
         VALUES ($1, '2031-12-20', '21:00', '21:01', 'Africa/Cairo'),
                ($1, '2031-12-20', '22:30', '22:31', 'Europe/Moscow'),
                ($1, '2031-12-20', '21:59', '22:00', 'Africa/Cairo')`,
        [idOf('crowded')],
      );
      at('2031-12-01T00:00:00.000Z');
      const stored: Array<{ id: string }> = await database.query(
        `SELECT id FROM professional_availabilities
         WHERE professional_id = $1 AND date = '2031-12-20'
         ORDER BY ("date" + start_time) AT TIME ZONE time_zone, id`,
        [idOf('crowded')],
      );

      const pages = await readAllPages('crowded', '2031-12-20', '2031-12-20');

      expect(stored).toHaveLength(1203);
      expect(pages.map((page) => slotIds(page).length)).toEqual([
        500, 500, 203,
      ]);
      pages.forEach((page) =>
        expect(page.days.map((day) => day.date)).toEqual(['2031-12-20']),
      );
      expect(pages.flatMap(slotIds)).toEqual(stored.map((slot) => slot.id));
    });

    it('repeats nothing and skips nothing when the range changes between pages', async () => {
      at('2031-12-01T00:00:00.000Z');
      const first = await read('crowded', '2031-12-20', '2031-12-20');
      const [taken] = slotIds(
        await read(
          'crowded',
          '2031-12-20',
          '2031-12-20',
          service,
          first.next_cursor as string,
        ),
      );
      // A slot of the next page is withdrawn before it is read.
      await slots.update(taken, { is_available: false });

      const second = await read(
        'crowded',
        '2031-12-20',
        '2031-12-20',
        service,
        first.next_cursor as string,
      );

      expect(slotIds(second)).not.toContain(taken);
      expect(
        slotIds(second).filter((id) => slotIds(first).includes(id)),
      ).toEqual([]);
      await slots.update(taken, { is_available: true });
    });

    it('costs two statements however many slots and bookings exist', async () => {
      at('2031-11-01T00:00:00.000Z');
      statements.length = 0;

      await read('busy', '2031-12-01', '2031-12-05');

      expect(statements).toHaveLength(2);
    });
  });

  describe('query plan', () => {
    // A node of PostgreSQL's JSON plan, read by its documented keys.
    type PlanNode = Record<string, unknown> & { Plans?: PlanNode[] };

    const collect = (node: PlanNode): PlanNode[] => [
      node,
      ...(node.Plans ?? []).flatMap(collect),
    ];

    const explain = async (
      options: string,
      settings: string[],
    ): Promise<PlanNode[]> => {
      statements.length = 0;
      at('2031-11-01T00:00:00.000Z');
      await read('open', '2032-02-01', '2032-02-07');
      const { sql, parameters } = statements[1];

      const runner = database.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        for (const setting of settings) await runner.query(setting);
        const [row]: Array<Record<string, Array<{ Plan: PlanNode }>>> =
          await runner.query(`EXPLAIN (${options}) ${sql}`, parameters);
        return collect(row['QUERY PLAN'][0].Plan);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    };

    const indexesOn = async (table: string, columns: string) => {
      const rows: Array<{ indexname: string }> = await database.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = $1 AND indexdef LIKE '%(' || $2 || ')'`,
        [table, columns],
      );
      return rows.map((row) => row.indexname);
    };

    beforeAll(async () => {
      // Seven days of slots for the professional that is read, among twenty
      // thousand slots and bookings that belong to someone else.
      await database.query(
        `INSERT INTO professional_availabilities
           (professional_id, date, start_time, end_time)
         SELECT $1, d::date, time '09:00' + n * interval '30 minutes',
                time '09:30' + n * interval '30 minutes'
         FROM generate_series('2032-02-01'::date, '2032-02-07'::date, '1 day') AS d,
              generate_series(0, 9) AS n`,
        [idOf('open')],
      );
      await database.query(
        `INSERT INTO professional_availabilities
           (professional_id, date, start_time, end_time, is_available)
         SELECT $1, d::date, time '06:00' + n * interval '10 minutes',
                time '06:10' + n * interval '10 minutes', false
         FROM generate_series('2032-01-01'::date, '2033-02-03'::date, '1 day') AS d,
              generate_series(0, 49) AS n`,
        [idOf('other')],
      );
      await database.query(
        `INSERT INTO bookings
           (patient_id, professional_id, booking_date, booking_time,
            consultation_type, amount, status, availability_id)
         SELECT $1, professional_id, date, start_time, 'video', 3000,
                'confirmed', id
         FROM professional_availabilities
         WHERE professional_id = $2 AND date >= '2032-01-01'`,
        [await createPatient(), idOf('other')],
      );
      await database.query('ANALYZE professional_availabilities');
      await database.query('ANALYZE bookings');
    }, 120_000);

    it('reads only the slots of the professional inside the date range', async () => {
      const [{ total }]: Array<{ total: string }> = await database.query(
        'SELECT COUNT(*) AS total FROM professional_availabilities',
      );
      const nodes = await explain('ANALYZE, FORMAT JSON', []);
      const slotScans = nodes.filter(
        (node) => node['Relation Name'] === 'professional_availabilities',
      );

      expect(Number(total)).toBeGreaterThan(20_000);
      expect(slotScans).toHaveLength(1);
      expect(slotScans[0]['Node Type']).not.toBe('Seq Scan');
      expect(String(slotScans[0]['Index Cond'])).toContain('professional_id');
      expect(String(slotScans[0]['Index Cond'])).toContain('date');
      expect(
        Number(slotScans[0]['Actual Rows'] ?? 0) +
          Number(slotScans[0]['Rows Removed by Filter'] ?? 0),
      ).toBeLessThanOrEqual(70);
    });

    it('has an index for the slot range and for each way a booking occupies a slot', async () => {
      const nodes = await explain('FORMAT JSON', [
        'SET LOCAL enable_seqscan = off',
        'SET LOCAL enable_bitmapscan = off',
        'SET LOCAL enable_hashjoin = off',
        'SET LOCAL enable_mergejoin = off',
      ]);
      const scans = nodes.filter((node) => node['Relation Name']);
      const used = scans.map((node) => node['Index Name']);

      expect(scans.map((node) => node['Relation Name']).sort()).toEqual([
        'bookings',
        'bookings',
        'professional_availabilities',
      ]);
      scans.forEach((node) => {
        expect(node['Node Type']).toMatch(/^Index (Only )?Scan$/);
        expect(node['Index Cond']).toBeTruthy();
      });
      expect(
        await indexesOn(
          'professional_availabilities',
          'professional_id, date, start_time',
        ),
      ).toEqual(expect.arrayContaining([used[0]]));
      expect(used).toEqual(
        expect.arrayContaining([
          ...(await indexesOn('bookings', 'availability_id')),
          ...(await indexesOn(
            'bookings',
            'professional_id, booking_date, booking_time',
          )),
        ]),
      );
    });
  });

  describe('concurrent bookings', () => {
    const within = async <T>(
      promise: Promise<T>,
      milliseconds: number,
    ): Promise<T> => {
      let timer: NodeJS.Timeout;
      const expiry = new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('The read waited on a booking')),
          milliseconds,
        );
      });
      try {
        return await Promise.race([promise, expiry]);
      } finally {
        clearTimeout(timer);
      }
    };

    it('lists a slot until the booking that takes it commits, without waiting for it', async () => {
      const date = nextDay();
      const [slot] = await offer('open', date, ['09:00', '09:30']);
      const patient = await createPatient();
      const runner = database.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        // What booking creation does, held open before it commits.
        await runner.query(
          'SELECT id FROM professional_availabilities WHERE id = $1 FOR UPDATE',
          [slot],
        );
        await runner.query(
          'UPDATE professional_availabilities SET is_available = false WHERE id = $1',
          [slot],
        );
        await runner.query(
          `INSERT INTO bookings
             (patient_id, professional_id, booking_date, booking_time,
              consultation_type, amount, status, availability_id)
           VALUES ($1, $2, $3, '09:00', 'video', 3000, 'pending', $4)`,
          [patient, idOf('open'), date, slot],
        );

        expect(slotIds(await within(read('open', date), 3000))).toEqual([slot]);

        await runner.commitTransaction();
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }

      expect(slotIds(await read('open', date))).toEqual([]);
    });

    it('keeps listing a slot whose booking is rolled back', async () => {
      const date = nextDay();
      const [slot] = await offer('open', date, ['09:00', '09:30']);
      const runner = database.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query(
        'UPDATE professional_availabilities SET is_available = false WHERE id = $1',
        [slot],
      );
      await runner.rollbackTransaction();
      await runner.release();

      expect(slotIds(await read('open', date))).toEqual([slot]);
    });

    it('stays consistent while patients book the listed slots', async () => {
      const date = nextDay();
      const times = Array.from({ length: 12 }, (_unused, index) => {
        const hour = String(8 + index).padStart(2, '0');
        return [`${hour}:00`, `${hour}:30`] as [string, string];
      });
      const offered = await offer('open', date, ...times);
      const taken = times.filter((_time, index) => index % 2 === 0);

      const [reads, created] = await Promise.all([
        Promise.all(
          Array.from({ length: 30 }, () => read('open', date).then(flatten)),
        ),
        Promise.all(taken.map(([start]) => book('open', date, start))),
      ]);

      expect(created).toHaveLength(6);
      reads.forEach((published) => {
        const instants = published.map((slot) => slot.starts_at);
        expect(instants).toEqual([...instants].sort());
        published.forEach((slot) => expect(offered).toContain(slot.id));
        // A slot that was never booked is in every read.
        offered
          .filter((_id, index) => index % 2 === 1)
          .forEach((id) =>
            expect(published.map((slot) => slot.id)).toContain(id),
          );
      });
      expect(slotIds(await read('open', date))).toEqual(
        offered.filter((_id, index) => index % 2 === 1),
      );
    });

    it('lets one of several patients book a listed slot; listing reserved it for nobody', async () => {
      const date = nextDay();
      const [slot] = await offer('contested', date, ['09:00', '09:30']);
      // Every patient saw the slot in a public response first.
      const seen = await Promise.all(
        Array.from({ length: 5 }, () => read('contested', date).then(slotIds)),
      );
      seen.forEach((listed) => expect(listed).toEqual([slot]));

      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () => book('contested', date, '09:00')),
      );

      const booked = attempts.filter(
        (attempt) => attempt.status === 'fulfilled',
      );
      const refused = attempts.filter(
        (attempt) => attempt.status === 'rejected',
      );
      expect(booked).toHaveLength(1);
      expect(refused).toHaveLength(4);
      refused.forEach((attempt) =>
        expect(
          (attempt as PromiseRejectedResult).reason.getStatus(),
        ).toBeGreaterThanOrEqual(400),
      );
      await expect(bookings.countBy({ availability_id: slot })).resolves.toBe(
        1,
      );
      expect(slotIds(await read('contested', date))).toEqual([]);
    });

    it('changes nothing it reads', async () => {
      const date = nextDay();
      await offer('open', date, ['09:00', '09:30'], ['10:00', '10:30']);
      await book('open', date, '10:00');
      const snapshot = () =>
        database.query(
          `SELECT 'slot' AS kind, id::text, xmin::text, updated_at
           FROM professional_availabilities WHERE professional_id = $1
           UNION ALL
           SELECT 'booking', id::text, xmin::text, updated_at
           FROM bookings WHERE professional_id = $1
           UNION ALL
           SELECT 'professional', id::text, xmin::text, updated_at
           FROM professionals WHERE id = $1
           ORDER BY 1, 2`,
          [idOf('open')],
        );
      const before = await snapshot();
      statements.length = 0;

      for (let index = 0; index < 5; index += 1) await read('open', date);
      const issued = statements.map(({ sql }) => sql);

      expect(await snapshot()).toEqual(before);
      expect(issued).toHaveLength(10);
      issued.forEach((sql) => {
        expect(sql).toMatch(/^SELECT /);
        expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|LOCK)\b/);
      });
    });
  });
});
