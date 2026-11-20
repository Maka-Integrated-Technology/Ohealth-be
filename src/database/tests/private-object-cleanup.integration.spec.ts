import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource } from 'typeorm';

import { OutboxEvent } from '../../modules/platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../modules/platform-events/enums/outbox-event-status.enum';
import { StorageCleanupService } from '../../modules/storage/storage-cleanup.service';
import { StorageService } from '../../modules/storage/storage.service';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Private-object cleanup on PostgreSQL', () => {
  let admin: DataSource;
  let database: DataSource;
  let schema: string;

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schema = `storage_cleanup_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`
      CREATE TABLE "${schema}".outbox_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        aggregate_type varchar NOT NULL,
        aggregate_id uuid,
        event_type varchar NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        status varchar NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        available_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        last_error text
      )
    `);
    await admin.query(
      `CREATE TABLE "${schema}".documents (id uuid PRIMARY KEY)`,
    );
    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      schema,
      entities: [OutboxEvent],
      synchronize: false,
    });
    await database.initialize();
  });

  afterEach(async () => {
    if (database?.isInitialized) await database.destroy();
    if (schema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  });

  afterAll(async () => {
    if (admin?.isInitialized) await admin.destroy();
  });

  it('commits the cleanup reference with a document deletion and retries after provider failure', async () => {
    const documentId = randomUUID();
    await database.query(`INSERT INTO "${schema}".documents (id) VALUES ($1)`, [
      documentId,
    ]);
    let fail = true;
    const storage = {
      deleteObject: jest.fn(async () => {
        if (fail) throw new Error('provider unavailable');
      }),
    } as unknown as StorageService;
    const cleanup = new StorageCleanupService(database, storage);
    const id = await database.transaction(async (manager) => {
      const cleanupId = await cleanup.enqueue(
        manager,
        'private-bucket',
        'old-key',
      );
      await manager.query(`DELETE FROM "${schema}".documents WHERE id = $1`, [
        documentId,
      ]);
      return cleanupId;
    });

    await expect(cleanup.process(id)).rejects.toThrow('provider unavailable');
    expect(
      await database.query(`SELECT id FROM "${schema}".documents`),
    ).toHaveLength(0);
    expect(
      await database.getRepository(OutboxEvent).findOneByOrFail({ id }),
    ).toMatchObject({
      status: OutboxEventStatus.PENDING,
      attempts: 1,
      payload: { bucket: 'private-bucket', key: 'old-key' },
    });

    fail = false;
    await cleanup.process(id);
    expect(storage.deleteObject).toHaveBeenLastCalledWith({
      bucket: 'private-bucket',
      key: 'old-key',
    });
    expect(
      await database.getRepository(OutboxEvent).findOneByOrFail({ id }),
    ).toMatchObject({
      status: OutboxEventStatus.PUBLISHED,
      processed_at: expect.any(Date),
    });
  });

  it('rolls back document removal when the cleanup transaction fails', async () => {
    const documentId = randomUUID();
    await database.query(`INSERT INTO "${schema}".documents (id) VALUES ($1)`, [
      documentId,
    ]);
    const cleanup = new StorageCleanupService(database, {
      deleteObject: jest.fn(),
    } as unknown as StorageService);

    await expect(
      database.transaction(async (manager) => {
        await cleanup.enqueue(manager, 'private-bucket', 'old-key');
        await manager.query(`DELETE FROM "${schema}".documents WHERE id = $1`, [
          documentId,
        ]);
        throw new Error('transaction failed');
      }),
    ).rejects.toThrow('transaction failed');

    expect(
      await database.query(`SELECT id FROM "${schema}".documents`),
    ).toEqual([{ id: documentId }]);
    expect(await database.getRepository(OutboxEvent).count()).toBe(0);
  });
});
