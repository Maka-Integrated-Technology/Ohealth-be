import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, LessThanOrEqual } from 'typeorm';

import { OutboxEvent } from '../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../platform-events/enums/outbox-event-status.enum';

import { StorageService } from './storage.service';

const EVENT_TYPE = 'private_object_delete';

/** Retains an exact private-object reference until versioned deletion succeeds. */
@Injectable()
export class StorageCleanupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  async enqueue(
    manager: EntityManager,
    bucket: string,
    key: string,
  ): Promise<string> {
    const event = await manager.save(
      manager.create(OutboxEvent, {
        aggregate_type: 'private_object',
        event_type: EVENT_TYPE,
        payload: { bucket, key },
        status: OutboxEventStatus.PENDING,
      }),
    );
    return event.id;
  }

  async process(id: string): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const event = await manager.findOne(OutboxEvent, {
          where: { id, event_type: EVENT_TYPE },
          lock: { mode: 'pessimistic_write' },
        });
        if (!event) throw new Error('Storage cleanup record not found.');
        if (event.status === OutboxEventStatus.PUBLISHED) return;
        if (event.status !== OutboxEventStatus.PENDING) {
          throw new Error('Storage cleanup record is not retryable.');
        }
        const { bucket, key } = event.payload;
        if (typeof bucket !== 'string' || typeof key !== 'string') {
          throw new Error('Storage cleanup reference is invalid.');
        }
        await this.storage.deleteObject({ bucket, key });
        event.status = OutboxEventStatus.PUBLISHED;
        event.processed_at = new Date();
        await manager.save(event);
      });
    } catch (error) {
      await this.recordFailure(id);
      throw error;
    }
  }

  private async recordFailure(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(OutboxEvent, {
        where: { id, event_type: EVENT_TYPE },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event || event.status !== OutboxEventStatus.PENDING) return;
      event.attempts += 1;
      event.available_at = new Date(
        Date.now() +
          Math.min(3600, 30 * 2 ** Math.min(event.attempts, 10)) * 1000,
      );
      await manager.save(event);
    });
  }

  /** Retry pending records independently, leaving failures available for later runs. */
  async processPending(
    limit = 20,
  ): Promise<{ completed: number; failed: number }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Invalid storage cleanup batch size.');
    }
    const pending = await this.dataSource.getRepository(OutboxEvent).find({
      select: { id: true },
      where: {
        event_type: EVENT_TYPE,
        status: OutboxEventStatus.PENDING,
        available_at: LessThanOrEqual(new Date()),
      },
      order: { available_at: 'ASC', created_at: 'ASC' },
      take: limit,
    });
    let completed = 0;
    let failed = 0;
    for (const event of pending) {
      try {
        await this.process(event.id);
        completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { completed, failed };
  }
}
