import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, LessThanOrEqual, In } from 'typeorm';

import { OutboxEvent } from '../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../platform-events/enums/outbox-event-status.enum';

import { StorageService } from './storage.service';

const EVENT_TYPE = 'private_object_delete';
const CLEANUP_LEASE_MS = 5 * 60 * 1000;
const LATE_UPLOAD_RECHECK_MS = 24 * 60 * 60 * 1000;

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
    availableAt?: Date,
  ): Promise<string> {
    return this.createEvent(manager, bucket, key, availableAt, false);
  }

  /** An abandoned PUT may complete after a cleanup probe. Keep its key for later reconciliation. */
  async reserveUpload(
    manager: EntityManager,
    bucket: string,
    key: string,
    availableAt: Date,
  ): Promise<string> {
    return this.createEvent(manager, bucket, key, availableAt, true);
  }

  private async createEvent(
    manager: EntityManager,
    bucket: string,
    key: string,
    availableAt: Date | undefined,
    reservation: boolean,
  ): Promise<string> {
    const event = await manager.save(
      manager.create(OutboxEvent, {
        aggregate_type: 'private_object',
        event_type: EVENT_TYPE,
        payload: reservation
          ? { bucket, key, reservation: true }
          : { bucket, key },
        status: OutboxEventStatus.PENDING,
        available_at: availableAt ?? new Date(),
      }),
    );
    return event.id;
  }

  async process(id: string): Promise<boolean> {
    const claim = await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(OutboxEvent, {
        where: { id, event_type: EVENT_TYPE },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) throw new Error('Storage cleanup record not found.');
      if (event.status === OutboxEventStatus.PUBLISHED) return null;
      if (
        event.status !== OutboxEventStatus.PENDING &&
        !(
          event.status === OutboxEventStatus.PROCESSING &&
          event.available_at <= new Date()
        )
      ) {
        throw new Error('Storage cleanup record is not retryable.');
      }
      const { bucket, key } = event.payload;
      if (typeof bucket !== 'string' || typeof key !== 'string') {
        throw new Error('Storage cleanup reference is invalid.');
      }
      event.status = OutboxEventStatus.PROCESSING;
      event.attempts += 1;
      event.available_at = new Date(Date.now() + CLEANUP_LEASE_MS);
      await manager.save(event);
      return {
        bucket,
        key,
        attempt: event.attempts,
        reservation: event.payload.reservation === true,
      };
    });
    if (!claim) return true;
    try {
      await this.storage.deleteObject({ bucket: claim.bucket, key: claim.key });
      return await this.dataSource.transaction(async (manager) => {
        const event = await manager.findOne(OutboxEvent, {
          where: { id, event_type: EVENT_TYPE },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !event ||
          event.status !== OutboxEventStatus.PROCESSING ||
          event.attempts !== claim.attempt
        )
          return false;
        if (claim.reservation) {
          // A late provider write can arrive after absence was observed. This
          // durable key remains eligible for repeated exact-key reconciliation.
          event.status = OutboxEventStatus.PENDING;
          event.available_at = new Date(Date.now() + LATE_UPLOAD_RECHECK_MS);
          await manager.save(event);
          return false;
        }
        event.status = OutboxEventStatus.PUBLISHED;
        event.processed_at = new Date();
        event.payload = {};
        await manager.save(event);
        return true;
      });
    } catch (error) {
      await this.recordFailure(id, claim.attempt);
      throw error;
    }
  }

  private async recordFailure(id: string, attempt: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(OutboxEvent, {
        where: { id, event_type: EVENT_TYPE },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !event ||
        event.status !== OutboxEventStatus.PROCESSING ||
        event.attempts !== attempt
      )
        return;
      event.status = OutboxEventStatus.PENDING;
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
        status: In([OutboxEventStatus.PENDING, OutboxEventStatus.PROCESSING]),
        available_at: LessThanOrEqual(new Date()),
      },
      order: { available_at: 'ASC', created_at: 'ASC' },
      take: limit,
    });
    let completed = 0;
    let failed = 0;
    for (const event of pending) {
      try {
        if (await this.process(event.id)) completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { completed, failed };
  }
}
