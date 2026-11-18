import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConflictException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Logger as WinstonLogger } from 'winston';

import { BookingService } from '../../modules/booking/booking.service';
import { ConsultationType as BookingRequestType } from '../../modules/booking/dto/create-booking.dto';
import {
  Booking,
  BookingStatus,
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
import { PublicDiscoveryVisibilityPolicy } from '../../modules/public-discovery/public-discovery-visibility.policy';
import { Speciality } from '../../modules/speciality/entities/speciality.entity';
import { SpecialityService } from '../../modules/speciality/speciality.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';
import { ActiveBookingPerSlot1794300000000 } from '../migrations/1794300000000-ActiveBookingPerSlot';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

const DAY = 24 * 60 * 60 * 1000;

// Runs every migration into a disposable database and books, cancels,
// rejects, and books again through the real booking and professional
// services, so the slot lifecycle is exercised the way the API drives it.
integration('Booking a freed slot again on real PostgreSQL', () => {
  const databaseName = 'rebooking_' + randomUUID().replaceAll('-', '');
  let admin: DataSource;
  let database: DataSource;
  let slots: Repository<ProfessionalAvailability>;
  let bookings: Repository<Booking>;
  let users: Repository<User>;
  let booking: BookingService;
  let schedule: ProfessionalService;
  let professionalId: string;
  let professionalUserId: string;
  let accountSequence = 0;
  let daySequence = 2;

  const nextDay = (): string => {
    daySequence += 1;
    return new Date(Date.now() + daySequence * DAY).toISOString().slice(0, 10);
  };

  const createAccount = (label: string) =>
    users.save(
      users.create({
        email: `${label}@private.example.com`,
        password: 'stored-password-hash',
        first_name: 'Case',
        last_name: label,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
        is_active: true,
        is_verified: true,
      }),
    );

  const createPatient = async (): Promise<string> => {
    accountSequence += 1;
    return (await createAccount(`patient-${accountSequence}`)).id;
  };

  const offer = async (date: string, start = '09:00'): Promise<string> => {
    const [slot] = await schedule.createAvailabilities(professionalId, {
      slots: [{ date, start_time: start, end_time: '09:30' }],
    });
    return slot.id;
  };

  const book = async (date: string, patientId?: string, time = '09:00') =>
    booking.create(patientId ?? (await createPatient()), {
      professional_id: professionalId,
      booking_date: date,
      booking_time: time,
      consultation_type: BookingRequestType.VIDEO,
    });

  const slotState = async (slotId: string) => {
    const slot = await slots.findOneByOrFail({ id: slotId });
    const held = await bookings.find({
      where: { availability_id: slotId },
      order: { created_at: 'ASC' },
    });
    return {
      is_available: slot.is_available,
      bookings: held.map((row) => row.status),
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
    });
    await database.initialize();
    await database.runMigrations();

    const professionals = database.getRepository(Professional);
    const specialities = database.getRepository(Speciality);
    slots = database.getRepository(ProfessionalAvailability);
    bookings = database.getRepository(Booking);
    users = database.getRepository(User);

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const winston = { child: () => logger } as unknown as WinstonLogger;
    booking = new BookingService(
      bookings,
      professionals,
      slots,
      database,
      winston,
    );
    schedule = new ProfessionalService(
      professionals,
      slots,
      database.getRepository(ProfessionalReview),
      users,
      database.getRepository(UserPersona),
      bookings,
      database.getRepository(PatientProfile),
      database.getRepository(ProfessionalPatientNote),
      new SpecialityService(
        specialities,
        new PublicDiscoveryVisibilityPolicy(),
      ),
      database,
      winston,
    );

    const speciality = await specialities.save(
      specialities.create({ name: 'Rebooking', is_active: true }),
    );
    const owner = await createAccount('professional');
    professionalUserId = owner.id;
    const professional = await professionals.save(
      professionals.create({
        user_id: owner.id,
        speciality_id: speciality.id,
        consultation_fee: 3000,
        consultation_type: ConsultationType.BOTH,
        is_active: true,
        verification_status: ProfessionalVerificationStatus.VERIFIED,
      }),
    );
    professionalId = professional.id;
  }, 120_000);

  afterAll(async () => {
    await database?.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  }, 60_000);

  describe('slot lifecycle', () => {
    it('books a slot again after the patient cancels', async () => {
      const date = nextDay();
      const slot = await offer(date);
      const first = await book(date);
      await booking.cancelBooking(first.id, first.patient_id);
      expect(await slotState(slot)).toEqual({
        is_available: true,
        bookings: [BookingStatus.CANCELLED],
      });

      const second = await book(date);

      expect(second.status).toBe(BookingStatus.PENDING);
      expect(await slotState(slot)).toEqual({
        is_available: false,
        bookings: [BookingStatus.CANCELLED, BookingStatus.PENDING],
      });
    });

    it('books a slot again after the professional rejects its booking', async () => {
      const date = nextDay();
      const slot = await offer(date);
      const first = await book(date);
      await schedule.rejectMyBooking(professionalUserId, first.id);

      const second = await book(date);

      expect(second.status).toBe(BookingStatus.PENDING);
      expect(await slotState(slot)).toEqual({
        is_available: false,
        bookings: [BookingStatus.CANCELLED, BookingStatus.PENDING],
      });
    });

    it('keeps a slot bookable through repeated cancellations', async () => {
      const date = nextDay();
      const slot = await offer(date);

      for (let round = 0; round < 3; round += 1) {
        const held = await book(date);
        await booking.cancelBooking(held.id, held.patient_id);
      }
      const last = await book(date);
      await schedule.acceptMyBooking(professionalUserId, last.id);

      expect(await slotState(slot)).toEqual({
        is_available: false,
        bookings: [
          BookingStatus.CANCELLED,
          BookingStatus.CANCELLED,
          BookingStatus.CANCELLED,
          BookingStatus.CONFIRMED,
        ],
      });
    });

    it('still refuses a slot while a booking holds it', async () => {
      const date = nextDay();
      const slot = await offer(date);
      await book(date);

      await expect(book(date)).rejects.toBeInstanceOf(Error);
      expect((await slotState(slot)).bookings).toEqual([BookingStatus.PENDING]);
    });

    it('lets exactly one of several patients take a freed slot', async () => {
      const date = nextDay();
      const slot = await offer(date);
      const first = await book(date);
      await booking.cancelBooking(first.id, first.patient_id);
      const patients = await Promise.all(
        Array.from({ length: 5 }, () => createPatient()),
      );

      const attempts = await Promise.allSettled(
        patients.map((patient) => book(date, patient)),
      );

      const refused = attempts.filter(
        (attempt): attempt is PromiseRejectedResult =>
          attempt.status === 'rejected',
      );
      expect(attempts.length - refused.length).toBe(1);
      refused.forEach(({ reason }) =>
        expect((reason as { getStatus(): number }).getStatus()).toBeLessThan(
          500,
        ),
      );
      expect(await slotState(slot)).toEqual({
        is_available: false,
        bookings: [BookingStatus.CANCELLED, BookingStatus.PENDING],
      });
    });
  });

  describe('database guarantee', () => {
    const insertBooking = async (
      slotId: string,
      date: string,
      status: BookingStatus,
      time = '09:00',
    ) =>
      bookings.insert({
        patient_id: await createPatient(),
        professional_id: professionalId,
        booking_date: date,
        booking_time: time,
        consultation_type: BookingRequestType.VIDEO,
        amount: 3000,
        status,
        availability_id: slotId,
      } as Partial<Booking>);

    it.each([
      [BookingStatus.PENDING],
      [BookingStatus.CONFIRMED],
      [BookingStatus.COMPLETED],
    ])(
      'refuses a second active booking of a slot held by a %s booking',
      async (status) => {
        const date = nextDay();
        const slot = await offer(date);
        await insertBooking(slot, date, status);

        await expect(
          insertBooking(slot, date, BookingStatus.PENDING),
        ).rejects.toMatchObject({
          code: '23505',
          constraint: 'UQ_bookings_active_availability',
        });
      },
    );

    it('keeps any number of cancelled bookings of a slot', async () => {
      const date = nextDay();
      const slot = await offer(date);
      for (let index = 0; index < 3; index += 1) {
        await insertBooking(slot, date, BookingStatus.CANCELLED);
      }
      await insertBooking(slot, date, BookingStatus.PENDING);

      expect((await slotState(slot)).bookings).toHaveLength(4);
    });

    it('answers a booking that loses to the database guarantee with a conflict', async () => {
      // Inconsistent stored state: the slot is offered while an active
      // booking at another time still names it, so only the database
      // guarantee stands between the request and a second holder.
      const date = nextDay();
      const slot = await offer(date);
      await insertBooking(slot, date, BookingStatus.PENDING, '08:00');

      const attempt = book(date);

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toMatchObject({
        response: { message: 'time slot already booked', statusCode: 409 },
      });
      expect((await slotState(slot)).is_available).toBe(true);
    });
  });

  describe('migration', () => {
    const migration = new ActiveBookingPerSlot1794300000000();
    let runner: QueryRunner;
    let schemaName: string;

    const statuses = async () => {
      const rows: Array<{ id: string; status: string; slot: string | null }> =
        await runner.query(
          'SELECT id, status, availability_id AS slot FROM bookings ORDER BY created_at, id',
        );
      return rows;
    };

    beforeEach(async () => {
      schemaName = 'rebooking_' + randomUUID().replaceAll('-', '');
      await database.query(`CREATE SCHEMA "${schemaName}"`);
      runner = database.createQueryRunner();
      await runner.connect();
      await runner.query(`SET search_path TO "${schemaName}", public`);
      // The table as it was before the migration.
      await runner.query(
        `CREATE TYPE status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled')`,
      );
      await runner.query(`
        CREATE TABLE bookings (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          status status_enum NOT NULL DEFAULT 'pending',
          availability_id uuid,
          CONSTRAINT "REL_7c4a7fb9075e1411f3c20430a9" UNIQUE (availability_id)
        )
      `);
    });

    afterEach(async () => {
      await runner?.release();
      await database.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    });

    it('keeps every existing booking and its link', async () => {
      const [held, freed] = [randomUUID(), randomUUID()];
      await runner.query(
        `INSERT INTO bookings (status, availability_id) VALUES ('confirmed', $1), ('cancelled', $2), ('pending', NULL)`,
        [held, freed],
      );
      const before = await statuses();

      await migration.up(runner);

      expect(await statuses()).toEqual(before);
    });

    it('then allows a cancelled slot to be booked again, but never twice at once', async () => {
      const slot = randomUUID();
      await runner.query(
        `INSERT INTO bookings (status, availability_id) VALUES ('cancelled', $1)`,
        [slot],
      );
      await migration.up(runner);

      await runner.query(
        `INSERT INTO bookings (status, availability_id) VALUES ('pending', $1)`,
        [slot],
      );
      await expect(
        runner.query(
          `INSERT INTO bookings (status, availability_id) VALUES ('confirmed', $1)`,
          [slot],
        ),
      ).rejects.toMatchObject({ code: '23505' });
    });

    it('rolls back to one link per slot, keeping the active or latest booking', async () => {
      const [rebooked, cancelledTwice] = [randomUUID(), randomUUID()];
      await migration.up(runner);
      await runner.query(
        `INSERT INTO bookings (created_at, status, availability_id) VALUES
          ('2026-01-01', 'cancelled', $1),
          ('2026-01-02', 'pending', $1),
          ('2026-01-03', 'cancelled', $1),
          ('2026-01-04', 'cancelled', $2),
          ('2026-01-05', 'cancelled', $2)`,
        [rebooked, cancelledTwice],
      );

      await migration.down(runner);

      expect(
        (await statuses()).map(({ status, slot }) => [status, slot]),
      ).toEqual([
        ['cancelled', null],
        ['pending', rebooked],
        ['cancelled', null],
        ['cancelled', null],
        ['cancelled', cancelledTwice],
      ]);
      await expect(
        runner.query(
          `INSERT INTO bookings (status, availability_id) VALUES ('cancelled', $1)`,
          [rebooked],
        ),
      ).rejects.toMatchObject({
        code: '23505',
        constraint: 'REL_7c4a7fb9075e1411f3c20430a9',
      });
    });
  });
});
