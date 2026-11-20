import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../../auth/account-access-policy.service';
import { AuthCapability } from '../../auth/context/auth-capability';
import { AuthContextService } from '../../auth/context/auth-context.service';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { normalizePatientPersonalUpdate } from '../../patient/personal-profile/patient-personal-profile.util';
import { User } from '../../user/entities/user.entity';

import { UpdateProfessionalPersonalProfileDto } from './professional-personal-profile.dto';

const PERSONAL_FIELDS = [
  'first_name',
  'last_name',
  'middle_name',
  'gender',
  'dob',
  'country',
] as const;

export interface IProfessionalPersonalProfile {
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string | null;
  dob: string | null;
  country: string | null;
  updated_at: Date;
}

@Injectable()
export class CanonicalProfessionalProfileService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly context: AuthContextService,
    private readonly policy: AccountAccessPolicyService,
  ) {}

  async update(
    userId: string,
    sessionId: string,
    dto: UpdateProfessionalPersonalProfileDto,
  ): Promise<IProfessionalPersonalProfile> {
    if (
      !dto ||
      typeof dto !== 'object' ||
      Object.keys(dto).some((key) => !PERSONAL_FIELDS.includes(key as never))
    ) {
      throw new BadRequestException(
        'Protected profile fields cannot be changed here.',
      );
    }
    const input = normalizePatientPersonalUpdate(dto);
    await this.context.assertCapabilities(userId, sessionId, [
      AuthCapability.ACCOUNT_PROFILE_UPDATE,
      AuthCapability.PERSONA_PROFESSIONAL,
    ]);
    return this.users.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      this.policy.assertCanAuthenticate(user);
      if (!user) {
        throw new ForbiddenException('Professional profile access required.');
      }
      const persona = await manager.findOne(UserPersona, {
        where: {
          user_id: user.id,
          persona_type: UserPersonaType.HEALTHCARE_PROFESSIONAL,
          is_active: true,
        },
        lock: { mode: 'pessimistic_read' },
      });
      if (!persona) {
        throw new ForbiddenException('Professional profile access required.');
      }

      const changes: Partial<Pick<User, (typeof PERSONAL_FIELDS)[number]>> = {};
      for (const key of PERSONAL_FIELDS) {
        if (input[key] !== undefined && input[key] !== user[key]) {
          changes[key] = input[key] as never;
        }
      }
      if (Object.keys(changes).length) {
        await manager.update(User, user.id, changes);
        Object.assign(user, changes);
      }
      const saved = Object.keys(changes).length
        ? await manager.findOneByOrFail(User, { id: user.id })
        : user;
      return {
        first_name: saved.first_name,
        last_name: saved.last_name,
        middle_name: saved.middle_name ?? null,
        gender: saved.gender ?? null,
        dob: saved.dob ?? null,
        country: saved.country ?? null,
        updated_at: saved.updated_at,
      };
    });
  }
}
