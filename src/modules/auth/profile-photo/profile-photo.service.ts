import { randomUUID } from 'crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { IMulterFile } from '../../../common/types';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../platform-events/enums/outbox-event-status.enum';
import { StorageCleanupService } from '../../storage/storage-cleanup.service';
import { StorageService } from '../../storage/storage.service';
import { User } from '../../user/entities/user.entity';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthContextService } from '../context/auth-context.service';
import { AuthSession } from '../entities/auth.entity';

import { normalizeProfilePhoto } from './profile-photo-image';
import {
  ProfilePhotoDownloadDto,
  ProfilePhotoRemovalDto,
  ProfilePhotoResponseDto,
} from './profile-photo.dto';
import { ProfilePhoto } from './profile-photo.entity';

// A reservation is durable before upload. The existing cleanup worker may reclaim
// an abandoned opaque key only after its grace period; activation locks that event.
const RESERVATION_GRACE_MS = 60 * 60 * 1000;
const SIGNED_GET_TTL_SECONDS = 300;

@Injectable()
export class ProfilePhotoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: AuthContextService,
    private readonly policy: AccountAccessPolicyService,
    private readonly storage: StorageService,
    private readonly cleanup: StorageCleanupService,
    private readonly config: ConfigService,
  ) {}

  async upload(
    userId: string,
    sessionId: string,
    file: IMulterFile,
  ): Promise<ProfilePhotoResponseDto> {
    await this.assertEligible(userId, sessionId);
    const image = await normalizeProfilePhoto(file);
    const key = `profile-photos/${randomUUID()}`;
    const bucket = this.privateBucket();
    const reservationId = await this.dataSource.transaction(async (manager) =>
      this.cleanup.reserveUpload(
        manager,
        bucket,
        key,
        new Date(Date.now() + RESERVATION_GRACE_MS),
      ),
    );

    let uploaded;
    try {
      uploaded = await this.storage.uploadPrivateObject({
        key,
        body: image.body,
        contentType: image.contentType,
      });
      if (!uploaded.versionId || uploaded.versionId === 'null')
        throw new Error('Missing object version');
    } catch {
      // The provider outcome may be ambiguous. Keep the delayed reservation so
      // a late object version is still found by exact-key cleanup.
      throw new InternalServerErrorException('Profile photo upload failed.');
    }

    let cleanupId: string | null;
    let photo: ProfilePhoto;
    try {
      ({ cleanupId, photo } = await this.dataSource.transaction(
        async (manager) => {
          await this.lockEligibleAccount(manager, userId, sessionId);
          const reservation = await manager.findOne(OutboxEvent, {
            where: { id: reservationId, event_type: 'private_object_delete' },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            !reservation ||
            reservation.status !== OutboxEventStatus.PENDING ||
            reservation.attempts !== 0
          ) {
            throw new ConflictException('Profile photo upload expired.');
          }
          const old = await manager.findOne(ProfilePhoto, {
            where: { user_id: userId },
          });
          const cleanupId = old
            ? await this.cleanup.enqueue(manager, old.bucket, old.object_key)
            : null;
          const photo = await manager.save(
            ProfilePhoto,
            manager.create(ProfilePhoto, {
              user_id: userId,
              object_key: key,
              bucket: uploaded.bucket,
              version_id: uploaded.versionId,
              content_type: image.contentType,
              byte_size: image.body.length,
              width: image.width,
              height: image.height,
              sha256: image.sha256,
            }),
          );
          reservation.status = OutboxEventStatus.PUBLISHED;
          reservation.processed_at = new Date();
          reservation.payload = {};
          await manager.save(reservation);
          return { photo, cleanupId };
        },
      ));
    } catch (error) {
      await this.releaseReservation(reservationId);
      if (
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      )
        throw error;
      throw new InternalServerErrorException(
        'Profile photo activation failed.',
      );
    }
    const cleanupPending = cleanupId
      ? !(await this.tryCleanup(cleanupId))
      : false;
    return this.toDto(photo, cleanupPending);
  }

  async signedGet(
    userId: string,
    sessionId: string,
  ): Promise<ProfilePhotoDownloadDto> {
    await this.assertEligible(userId, sessionId);
    return this.dataSource.transaction(async (manager) => {
      await this.lockEligibleAccount(manager, userId, sessionId);
      const photo = await manager.findOne(ProfilePhoto, {
        where: { user_id: userId },
      });
      if (!photo) throw new NotFoundException('Profile photo not found.');
      try {
        const url = await this.storage.createSignedGetUrl({
          bucket: photo.bucket,
          key: photo.object_key,
          versionId: photo.version_id,
          expiresInSeconds: SIGNED_GET_TTL_SECONDS,
          responseContentDisposition: 'inline; filename="profile-photo.jpg"',
        });
        return { url, expires_in_seconds: SIGNED_GET_TTL_SECONDS };
      } catch {
        throw new InternalServerErrorException(
          'Profile photo retrieval failed.',
        );
      }
    });
  }

  async remove(
    userId: string,
    sessionId: string,
  ): Promise<ProfilePhotoRemovalDto> {
    await this.assertEligible(userId, sessionId);
    const cleanupId = await this.dataSource.transaction(async (manager) => {
      await this.lockEligibleAccount(manager, userId, sessionId);
      const photo = await manager.findOne(ProfilePhoto, {
        where: { user_id: userId },
      });
      if (!photo) return null;
      const id = await this.cleanup.enqueue(
        manager,
        photo.bucket,
        photo.object_key,
      );
      await manager.remove(photo);
      return id;
    });
    if (!cleanupId) return { cleanup_status: 'completed' };
    return {
      cleanup_status: (await this.tryCleanup(cleanupId))
        ? 'completed'
        : 'pending',
    };
  }

  private async assertEligible(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const context = await this.context.resolve(userId, sessionId);
    if (
      !context.personas.some(
        (persona) =>
          persona.type === UserPersonaType.PATIENT ||
          persona.type === UserPersonaType.HEALTHCARE_PROFESSIONAL,
      )
    ) {
      throw new ForbiddenException('Personal profile access required.');
    }
  }

  private async lockEligibleAccount(
    manager: EntityManager,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    this.policy.assertCanAuthenticate(user);
    const session = await manager.findOne(AuthSession, {
      where: { user_id: userId, session_id: sessionId, revoked_at: IsNull() },
      lock: { mode: 'pessimistic_read' },
    });
    if (!session || session.expires_at <= new Date())
      throw new ForbiddenException('Session is unavailable.');
    const persona = await manager.findOne(UserPersona, {
      where: [
        {
          user_id: userId,
          persona_type: UserPersonaType.PATIENT,
          is_active: true,
        },
        {
          user_id: userId,
          persona_type: UserPersonaType.HEALTHCARE_PROFESSIONAL,
          is_active: true,
        },
      ],
      lock: { mode: 'pessimistic_read' },
    });
    if (!persona)
      throw new ForbiddenException('Personal profile access required.');
  }

  private privateBucket(): string {
    const bucket = this.config.get<string>('storage.privateBucket')?.trim();
    if (!bucket)
      throw new InternalServerErrorException(
        'Profile photo storage is unavailable.',
      );
    return bucket;
  }

  private async releaseReservation(id: string): Promise<void> {
    try {
      await this.dataSource
        .getRepository(OutboxEvent)
        .update(
          { id, status: OutboxEventStatus.PENDING },
          { available_at: new Date() },
        );
      await this.cleanup.process(id);
    } catch {
      // The pre-upload record remains durable for the retry worker.
    }
  }

  private async tryCleanup(id: string): Promise<boolean> {
    try {
      await this.cleanup.process(id);
      return true;
    } catch {
      return false;
    }
  }

  private toDto(
    photo: ProfilePhoto,
    cleanupPending: boolean,
  ): ProfilePhotoResponseDto {
    return {
      width: photo.width,
      height: photo.height,
      byte_size: photo.byte_size,
      content_type: 'image/jpeg',
      updated_at: photo.updated_at,
      cleanup_pending: cleanupPending,
    };
  }
}
