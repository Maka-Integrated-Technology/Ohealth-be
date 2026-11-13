import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, Repository } from 'typeorm';

import { PublicSearchQueryDto } from '../../modules/public-discovery/dto/public-discovery-query.dto';
import { PublicDiscoveryVisibilityPolicy } from '../../modules/public-discovery/public-discovery-visibility.policy';
import { PublicResourceNotFoundException } from '../../modules/public-discovery/public-discovery.errors';
import { Speciality } from '../../modules/speciality/entities/speciality.entity';
import { SpecialityService } from '../../modules/speciality/speciality.service';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

// Every speciality this suite stores carries the marker, so a search for it
// isolates them from the reference specialities that migrations seed.
const MARKER = 'zqcat';

interface ISeed {
  key: string;
  name: string;
  active?: boolean;
  description?: string;
  icon?: string;
}

const SEEDS: ISeed[] = [
  { key: 'gamma', name: `${MARKER} Gamma` },
  { key: 'alpha', name: `${MARKER} alpha`, icon: 'alpha-care' },
  { key: 'alphaUpper', name: `${MARKER} ALPHA` },
  { key: 'beta', name: `${MARKER.toUpperCase()} Beta` },
  { key: 'percent', name: `${MARKER} 100% care` },
  { key: 'underscore', name: `${MARKER} under_score` },
  {
    key: 'privateIcon',
    name: `${MARKER} delta`,
    icon: 'specialities/private/icon.png',
    description: 'Described speciality',
  },
  { key: 'inactive', name: `${MARKER} inactive`, active: false },
  { key: 'inactiveAlpha', name: `${MARKER} alphabet`, active: false },
];

// Runs every migration into a disposable database, then drives the real
// SpecialityService against the stored `specialities` rows.
integration('Public speciality catalogue on real PostgreSQL', () => {
  const databaseName = 'catalogue_' + randomUUID().replaceAll('-', '');
  let admin: DataSource;
  let database: DataSource;
  let specialities: Repository<Speciality>;
  let service: SpecialityService;
  const ids = new Map<string, string>();

  const search = (overrides: Partial<PublicSearchQueryDto> = {}) =>
    service.findPublicCatalogue(
      Object.assign(new PublicSearchQueryDto(), { q: MARKER, ...overrides }),
    );
  const idOf = (key: string): string => ids.get(key) as string;

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

    specialities = database.getRepository(Speciality);
    service = new SpecialityService(
      specialities,
      new PublicDiscoveryVisibilityPolicy(),
    );

    for (const seed of SEEDS) {
      const saved = await specialities.save(
        specialities.create({
          name: seed.name,
          description: seed.description,
          icon: seed.icon,
          is_active: seed.active ?? true,
        }),
      );
      ids.set(seed.key, saved.id);
    }
  }, 120_000);

  afterAll(async () => {
    await database?.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  });

  it('lists every active speciality and no inactive one', async () => {
    const stored = await specialities.find();
    const active = stored.filter((row) => row.is_active).map((row) => row.id);
    const collected: string[] = [];

    for (let page = 1; ; page += 1) {
      const result = await service.findPublicCatalogue(
        Object.assign(new PublicSearchQueryDto(), { page, limit: 3 }),
      );
      collected.push(...result.items.map((item) => item.id));
      expect(result.meta.total).toBe(active.length);
      if (!result.meta.has_next) break;
    }

    expect(collected).toHaveLength(active.length);
    expect([...collected].sort()).toEqual([...active].sort());
    expect(collected).not.toContain(idOf('inactive'));
    expect(collected).not.toContain(idOf('inactiveAlpha'));
  });

  it('orders by name without regard to case, then by identifier', async () => {
    const result = await search({ limit: 50 });
    const [firstAlpha, secondAlpha] = [
      idOf('alpha'),
      idOf('alphaUpper'),
    ].sort();

    expect(result.items.map((item) => item.id)).toEqual([
      idOf('percent'),
      firstAlpha,
      secondAlpha,
      idOf('beta'),
      idOf('privateIcon'),
      idOf('gamma'),
      idOf('underscore'),
    ]);
  });

  it('keeps names that differ only by case as distinct entries', async () => {
    const result = await search({ q: `${MARKER} alpha` });

    expect(result.items.map((item) => item.name).sort()).toEqual(
      [`${MARKER} ALPHA`, `${MARKER} alpha`].sort(),
    );
  });

  it('pages through the catalogue without gaps or repeats', async () => {
    const whole = await search({ limit: 50 });
    const paged: string[] = [];

    for (const page of [1, 2, 3, 4]) {
      const result = await search({ page, limit: 2 });
      paged.push(...result.items.map((item) => item.id));
      expect(result.meta).toEqual({
        page,
        limit: 2,
        total: 7,
        total_pages: 4,
        has_next: page < 4,
        has_previous: page > 1,
      });
    }

    expect(paged).toEqual(whole.items.map((item) => item.id));
  });

  it('returns an empty page beyond the last one', async () => {
    const result = await search({ page: 5, limit: 2 });

    expect(result.items).toEqual([]);
    expect(result.meta).toMatchObject({ total: 7, has_next: false });
  });

  it('searches the name without regard to case', async () => {
    const result = await search({ q: `${MARKER.toUpperCase()} BET` });

    expect(result.items.map((item) => item.id)).toEqual([idOf('beta')]);
  });

  it.each([
    ['0% c', 'percent'],
    ['r_s', 'underscore'],
    [`${MARKER} 100% care`, 'percent'],
    [`${MARKER} under_score`, 'underscore'],
  ])('finds the literal wildcard character in %p', async (q, key) => {
    const result = await search({ q });

    expect(result.items.map((item) => item.id)).toEqual([idOf(key)]);
  });

  // Each term would match stored names if its wildcard were interpreted.
  it.each([[`${MARKER}%alpha`], [`${MARKER}_alpha`], ['%%'], ['__']])(
    'does not interpret the wildcard in %p',
    async (q) => {
      const result = await search({ q });

      expect(result).toMatchObject({ items: [], meta: { total: 0 } });
    },
  );

  it('treats quoting and escape characters in a search as text', async () => {
    for (const q of ["' OR '1'='1", '\\', "'; DROP TABLE specialities; --"]) {
      const result = await search({ q });
      expect(result).toMatchObject({ items: [], meta: { total: 0 } });
    }

    await expect(specialities.count()).resolves.toBeGreaterThan(0);
  });

  it('never finds an inactive speciality by searching for it', async () => {
    const result = await search({ q: `${MARKER} inactive` });

    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('publishes only the public fields of a stored row', async () => {
    const result = await search({ q: `${MARKER} delta` });

    expect(result.items).toEqual([
      {
        id: idOf('privateIcon'),
        name: `${MARKER} delta`,
        description: 'Described speciality',
        icon: null,
      },
    ]);
  });

  it('retrieves one active speciality by identifier', async () => {
    await expect(service.findPublicById(idOf('alpha'))).resolves.toEqual({
      id: idOf('alpha'),
      name: `${MARKER} alpha`,
      description: null,
      icon: 'alpha-care',
    });
  });

  it.each([['inactive'], ['inactiveAlpha']])(
    'reports the %s speciality as not found',
    async (key) => {
      await expect(service.findPublicById(idOf(key))).rejects.toThrow(
        PublicResourceNotFoundException,
      );
    },
  );

  it('reports an unknown identifier as not found', async () => {
    await expect(service.findPublicById(randomUUID())).rejects.toThrow(
      PublicResourceNotFoundException,
    );
  });

  it('hides a speciality as soon as it is deactivated', async () => {
    const saved = await specialities.save(
      specialities.create({ name: `${MARKER}-toggle omega`, is_active: true }),
    );
    await expect(service.findPublicById(saved.id)).resolves.toMatchObject({
      id: saved.id,
    });

    await service.update(saved.id, { is_active: false });

    await expect(service.findPublicById(saved.id)).rejects.toThrow(
      PublicResourceNotFoundException,
    );
    await specialities.delete(saved.id);
  });

  it('leaves the protected readers unchanged', async () => {
    const protectedList = await service.findAll();
    const inactive = await service.findById(idOf('inactive'));

    expect(protectedList.every((row) => row.is_active)).toBe(true);
    expect(protectedList[0]).toEqual(
      expect.objectContaining({
        is_active: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      }),
    );
    expect(inactive).toMatchObject({
      id: idOf('inactive'),
      is_active: false,
    });
  });
});
