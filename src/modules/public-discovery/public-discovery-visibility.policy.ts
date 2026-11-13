import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import {
  Professional,
  ProfessionalVerificationStatus,
} from '../professional/entities/professional.entity';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';

export type PublicSpecialityVisibilityState = Pick<Speciality, 'is_active'>;

export type PublicProfessionalVisibilityState = Pick<
  Professional,
  'is_active' | 'verification_status'
> & {
  user?: Pick<User, 'account_status' | 'email_verified_at'> | null;
  speciality?: PublicSpecialityVisibilityState | null;
};

export interface IPublicProfessionalQueryAliases {
  professional: string;
  user: string;
  speciality: string;
}

/**
 * The one place that decides what unauthenticated consumers may discover.
 *
 * A speciality is visible only while it is active. A professional is visible
 * only while the profile is active and approved, the owning account is active
 * with a verified contact, and the profile's speciality is itself visible.
 * Every decision is derived from stored state; nothing supplied by a client
 * takes part. Missing state fails closed.
 */
@Injectable()
export class PublicDiscoveryVisibilityPolicy {
  isSpecialityVisible(
    speciality: PublicSpecialityVisibilityState | null | undefined,
  ): boolean {
    return speciality?.is_active === true;
  }

  isProfessionalVisible(
    professional: PublicProfessionalVisibilityState | null | undefined,
  ): boolean {
    if (!professional) return false;

    return (
      professional.is_active === true &&
      professional.verification_status ===
        ProfessionalVerificationStatus.VERIFIED &&
      professional.user?.account_status === AccountStatus.ACTIVE &&
      professional.user.email_verified_at instanceof Date &&
      this.isSpecialityVisible(professional.speciality)
    );
  }

  /** Restricts a query to visible specialities joined or selected as `alias`. */
  applySpecialityVisibility<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    return query.andWhere(`${alias}.is_active = :publicSpecialityActive`, {
      publicSpecialityActive: true,
    });
  }

  /**
   * Restricts a query to visible professionals. The owning user and the
   * speciality must already be inner-joined under the supplied aliases.
   */
  applyProfessionalVisibility<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    aliases: IPublicProfessionalQueryAliases,
  ): SelectQueryBuilder<T> {
    query
      .andWhere(
        `${aliases.professional}.is_active = :publicProfessionalActive`,
        {
          publicProfessionalActive: true,
        },
      )
      .andWhere(
        `${aliases.professional}.verification_status = :publicProfessionalStatus`,
        { publicProfessionalStatus: ProfessionalVerificationStatus.VERIFIED },
      )
      .andWhere(`${aliases.user}.account_status = :publicAccountStatus`, {
        publicAccountStatus: AccountStatus.ACTIVE,
      })
      .andWhere(`${aliases.user}.email_verified_at IS NOT NULL`);

    return this.applySpecialityVisibility(query, aliases.speciality);
  }
}
