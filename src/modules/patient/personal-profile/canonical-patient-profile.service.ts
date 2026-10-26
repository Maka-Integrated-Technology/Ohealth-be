import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../../auth/account-access-policy.service';
import { CanonicalAuthContextService } from '../../auth/context/canonical-auth-context.service';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { User } from '../../user/entities/user.entity';
import { PatientProfile } from '../entities/patient-profile.entity';

import { UpdatePatientPersonalProfileDto } from './patient-personal-profile.dto';
import { normalizePatientPersonalUpdate } from './patient-personal-profile.util';

export interface IPatientPersonalProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string | null;
  dob: string | null;
  country: string | null;
  address: string | null;
}

/**
 * Foundation for #90, intentionally not a second live endpoint. Existing
 * /auth/me contract remains intact pending reviewed client/API migration.
 * Caller must pass a verified-session user ID, never a request-body user ID.
 */
@Injectable()
export class CanonicalPatientProfileService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(PatientProfile)
    private readonly patientProfiles: Repository<PatientProfile>,
    private readonly context: CanonicalAuthContextService,
    private readonly policy: AccountAccessPolicyService,
  ) {}

  async get(userId: string): Promise<IPatientPersonalProfile> {
    await this.context.assertCanEditPatientProfile(userId);
    const user = await this.users.findOne({ where: { id: userId } });
    this.policy.assertCanAuthenticate(user);
    if (!user) {
      throw new ForbiddenException('Patient profile access required.');
    }
    const profile = await this.patientProfiles.findOne({
      where: { user_id: user.id },
    });
    return this.project(user, profile);
  }

  async update(
    userId: string,
    dto: UpdatePatientPersonalProfileDto,
  ): Promise<IPatientPersonalProfile> {
    const input = normalizePatientPersonalUpdate(dto);
    await this.context.assertCanEditPatientProfile(userId);
    return this.users.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      this.policy.assertCanAuthenticate(user);
      if (!user) {
        throw new ForbiddenException('Patient profile access required.');
      }
      // Re-check authority under the write transaction to close account-state
      // and persona-removal races. Locking the user serializes profile writes.
      const persona = await manager.findOne(UserPersona, {
        where: {
          user_id: user.id,
          persona_type: UserPersonaType.PATIENT,
          is_active: true,
        },
      });
      if (!persona) {
        throw new ForbiddenException('Patient profile access required.');
      }

      const changes: Partial<
        Pick<
          User,
          | 'first_name'
          | 'last_name'
          | 'middle_name'
          | 'gender'
          | 'dob'
          | 'country'
        >
      > = {};
      for (const key of [
        'first_name',
        'last_name',
        'middle_name',
        'gender',
        'dob',
        'country',
      ] as const) {
        if (input[key] !== undefined && input[key] !== user[key]) {
          changes[key] = input[key] as never;
        }
      }
      if (Object.keys(changes).length) {
        await manager.update(User, user.id, changes);
        Object.assign(user, changes);
      }
      let profile = await manager.findOne(PatientProfile, {
        where: { user_id: user.id },
      });
      if (input.address !== undefined) {
        if (!profile) {
          profile = await manager.save(
            PatientProfile,
            manager.create(PatientProfile, {
              user_id: user.id,
              address: input.address,
            }),
          );
        } else if (profile.address !== input.address) {
          await manager.update(PatientProfile, profile.id, {
            address: input.address,
          });
          profile.address = input.address;
        }
      }
      return this.project(user, profile);
    });
  }

  private project(
    user: User,
    profile: PatientProfile | null,
  ): IPatientPersonalProfile {
    return {
      user_id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name ?? null,
      gender: user.gender ?? null,
      dob: user.dob ?? null,
      country: user.country ?? null,
      address: profile?.address ?? null,
    };
  }
}
