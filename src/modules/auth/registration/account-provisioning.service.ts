import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { LegalDocumentType } from '../../identity/enums/legal-document-type.enum';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { User } from '../../user/entities/user.entity';
import { UserAccountStatusHistory } from '../../user/entities/user-account-status-history.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';

export interface IAccountProvisioningInput {
  email: string;
  password: string;
  passwordAuthenticationEnabled: boolean;
  firstName: string;
  lastName: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  personaType: UserPersonaType | null;
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  acceptedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AccountProvisioningService {
  async provisionPersonaAndLegalIdentity(
    manager: EntityManager,
    input: IAccountProvisioningInput,
  ): Promise<User> {
    const active = input.accountStatus === AccountStatus.ACTIVE;
    const user = await manager.save(
      User,
      manager.create(User, {
        email: input.email,
        password: input.password,
        password_authentication_enabled: input.passwordAuthenticationEnabled,
        first_name: input.firstName,
        last_name: input.lastName,
        role: [],
        account_status: input.accountStatus,
        email_verified_at: input.emailVerifiedAt,
        is_active: active,
        is_verified: input.emailVerifiedAt !== null,
        verification_code: null,
        verification_code_expires_at: null,
        reset_token: null,
        reset_token_expiry: null,
      }),
    );
    await manager.insert(UserAccountStatusHistory, {
      user_id: user.id,
      previous_status: null,
      new_status: input.accountStatus,
      changed_by_user_id: null,
      reason: input.passwordAuthenticationEnabled
        ? 'password_registration'
        : 'google_registration',
    });

    if (input.personaType) {
      await manager.insert(UserPersona, {
        user_id: user.id,
        persona_type: input.personaType,
        is_active: true,
      });
      if (input.personaType === UserPersonaType.PATIENT) {
        await manager.insert(PatientProfile, { user_id: user.id });
      }
    }

    await manager.insert(LegalAcceptance, [
      {
        user_id: user.id,
        document_type: LegalDocumentType.TERMS_OF_SERVICE,
        document_version: input.acceptedTermsVersion,
        accepted_at: input.acceptedAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
      {
        user_id: user.id,
        document_type: LegalDocumentType.PRIVACY_POLICY,
        document_version: input.acceptedPrivacyVersion,
        accepted_at: input.acceptedAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    ]);
    return user;
  }
}
