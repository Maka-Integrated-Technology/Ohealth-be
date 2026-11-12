import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, Repository } from 'typeorm';

import {
  Professional,
  ProfessionalVerificationStatus,
} from '../../modules/professional/entities/professional.entity';
import { PublicDiscoveryVisibilityPolicy } from '../../modules/public-discovery/public-discovery-visibility.policy';
import {
  toPublicProfessionalDetail,
  toPublicSpeciality,
} from '../../modules/public-discovery/public-discovery.mapper';
import { Speciality } from '../../modules/speciality/entities/speciality.entity';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

interface IProfessionalCase {
  label: string;
  visible: boolean;
  professional?: Partial<Professional>;
  user?: Partial<User>;
  speciality?: 'active' | 'inactive';
}

const CASES: IProfessionalCase[] = [
  { label: 'visible', visible: true },
  {
    label: 'inactive-profile',
    visible: false,
    professional: { is_active: false },
  },
  {
    label: 'pending-review',
    visible: false,
    professional: {
      verification_status: ProfessionalVerificationStatus.PENDING,
    },
  },
  {
    label: 'rejected-review',
    visible: false,
    professional: {
      verification_status: ProfessionalVerificationStatus.REJECTED,
    },
  },
  {
    label: 'pending-account',
    visible: false,
    user: {
      account_status: AccountStatus.PENDING_VERIFICATION,
      email_verified_at: null,
    },
  },
  {
    label: 'suspended-account',
    visible: false,
    user: { account_status: AccountStatus.SUSPENDED },
  },
  {
    label: 'deactivated-account',
    visible: false,
    user: { account_status: AccountStatus.DEACTIVATED },
  },
  {
    label: 'inactive-speciality',
    visible: false,
    speciality: 'inactive',
  },
  {
    label: 'unavailable-but-visible',
    visible: true,
    professional: { is_available: false },
  },
];

// Runs every migration into a disposable database, then proves the single
// visibility policy against the real professional, user, and speciality
// tables rather than against mocks.
integration('Public discovery visibility on real PostgreSQL', () => {
  const policy = new PublicDiscoveryVisibilityPolicy();
  const databaseName = 'discovery_' + randomUUID().replaceAll('-', '');
  let admin: DataSource;
  let database: DataSource;
  let professionals: Repository<Professional>;
  let specialities: Repository<Speciality>;
  let tablesBeforeSeeding: string[];
  const professionalIds = new Map<string, string>();
  const specialityIds = { active: '', inactive: '' };

  const listTables = async (): Promise<string[]> => {
    const rows: Array<{ table_name: string }> = await database.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    return rows.map((row) => row.table_name);
  };

  const visibleProfessionals = () => {
    const query = professionals
      .createQueryBuilder('professional')
      .innerJoinAndSelect('professional.user', 'account')
      .innerJoinAndSelect('professional.speciality', 'speciality');
    return policy.applyProfessionalVisibility(query, {
      professional: 'professional',
      user: 'account',
      speciality: 'speciality',
    });
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
    tablesBeforeSeeding = await listTables();

    professionals = database.getRepository(Professional);
    specialities = database.getRepository(Speciality);
    const users = database.getRepository(User);

    // Migrations seed reference specialities; this suite reasons only about
    // the two it creates and never depends on the seeded names.
    for (const state of ['active', 'inactive'] as const) {
      const saved = await specialities.save(
        specialities.create({
          name: `Discovery ${state} ${databaseName}`,
          description: `${state} speciality`,
          is_active: state === 'active',
        }),
      );
      specialityIds[state] = saved.id;
    }

    for (const testCase of CASES) {
      const accountStatus =
        testCase.user?.account_status ?? AccountStatus.ACTIVE;
      const emailVerifiedAt =
        testCase.user && 'email_verified_at' in testCase.user
          ? testCase.user.email_verified_at
          : new Date('2026-01-01T00:00:00.000Z');
      // The legacy flags must mirror canonical state or the schema rejects
      // the row (CHK_users_canonical_account_access).
      const user = await users.save(
        users.create({
          email: `${testCase.label}@example.com`,
          password: 'stored-password-hash',
          first_name: 'Case',
          last_name: testCase.label,
          phone: '+2348000000000',
          dob: '1990-04-12',
          account_status: accountStatus,
          email_verified_at: emailVerifiedAt,
          is_active: accountStatus === AccountStatus.ACTIVE,
          is_verified: emailVerifiedAt instanceof Date,
        }),
      );
      const professional = await professionals.save(
        professionals.create({
          user_id: user.id,
          speciality_id: specialityIds[testCase.speciality ?? 'active'],
          license_number: `LIC-${testCase.label}`,
          consultation_fee: 5000,
          years_of_experience: 5,
          is_active: true,
          is_available: true,
          verification_status: ProfessionalVerificationStatus.VERIFIED,
          about: 'Public biography',
          image: 'https://cdn.example.com/case.png',
          ...testCase.professional,
        }),
      );
      professionalIds.set(testCase.label, professional.id);
    }
  }, 120_000);

  afterAll(async () => {
    await database?.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  });

  it('adds no table to the migrated schema', async () => {
    await expect(listTables()).resolves.toEqual(tablesBeforeSeeding);
    expect(tablesBeforeSeeding).toEqual(
      expect.arrayContaining(['professionals', 'specialities', 'users']),
    );
  });

  it('returns exactly the active, approved professionals', async () => {
    const rows = await visibleProfessionals()
      .andWhere('professional.id IN (:...ids)', {
        ids: [...professionalIds.values()],
      })
      .getMany();

    const expected = CASES.filter((testCase) => testCase.visible).map(
      (testCase) => professionalIds.get(testCase.label),
    );
    expect(rows.map((row) => row.id).sort()).toEqual(expected.sort());
  });

  it.each(CASES)(
    'resolves the $label professional by identifier as visible=$visible',
    async ({ label, visible }) => {
      const row = await visibleProfessionals()
        .andWhere('professional.id = :id', { id: professionalIds.get(label) })
        .getOne();

      expect(row !== null).toBe(visible);
    },
  );

  it('agrees with the in-memory rule for every stored professional', async () => {
    const all = await professionals.find({
      where: [...professionalIds.values()].map((id) => ({ id })),
      relations: ['user', 'speciality'],
    });
    const visibleIds = new Set(
      (await visibleProfessionals().getMany()).map((row) => row.id),
    );

    expect(all).toHaveLength(CASES.length);
    all.forEach((professional) =>
      expect(policy.isProfessionalVisible(professional)).toBe(
        visibleIds.has(professional.id),
      ),
    );
  });

  it('returns only active specialities', async () => {
    const rows = await policy
      .applySpecialityVisibility(
        specialities.createQueryBuilder('speciality'),
        'speciality',
      )
      .getMany();
    const ids = rows.map((row) => row.id);

    expect(ids).toContain(specialityIds.active);
    expect(ids).not.toContain(specialityIds.inactive);
    expect(rows.every((row) => row.is_active)).toBe(true);
  });

  it('maps stored rows to responses free of private data', async () => {
    const professional = await visibleProfessionals()
      .andWhere('professional.id = :id', {
        id: professionalIds.get('visible'),
      })
      .getOneOrFail();
    const serialized = JSON.stringify([
      toPublicProfessionalDetail(professional),
      toPublicSpeciality(professional.speciality),
    ]);

    [
      'visible@example.com',
      '+2348000000000',
      '1990-04-12',
      'LIC-visible',
      'stored-password-hash',
      professional.user_id,
    ].forEach((value) => expect(serialized).not.toContain(value));
  });
});
