import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import * as sysMsg from '../../constants/system.messages';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

export type AccountIdentity = Pick<
  User,
  'account_status' | 'email_verified_at'
>;

const ADMIN_TRANSITIONS: Readonly<
  Record<AccountStatus, readonly AccountStatus[]>
> = {
  [AccountStatus.PENDING_VERIFICATION]: [
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
  ],
  [AccountStatus.ACTIVE]: [AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED],
  [AccountStatus.SUSPENDED]: [AccountStatus.ACTIVE, AccountStatus.DEACTIVATED],
  [AccountStatus.DEACTIVATED]: [],
};

@Injectable()
export class AccountAccessPolicyService {
  assertKnownStatus(status: AccountStatus): void {
    if (!Object.values(AccountStatus).includes(status)) {
      // Fail closed on unknown or null values; never fall back to legacy flags.
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }
  }

  assertCanAuthenticate(user: AccountIdentity | null | undefined): void {
    if (!user) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }
    this.assertKnownStatus(user.account_status);
    if (
      user.account_status !== AccountStatus.ACTIVE ||
      !user.email_verified_at
    ) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }
  }

  assertCanVerifyContact(user: AccountIdentity): void {
    this.assertKnownStatus(user.account_status);
    if (user.account_status === AccountStatus.ACTIVE) {
      throw new BadRequestException(sysMsg.ACCOUNT_ALREADY_VERIFIED);
    }
    if (
      user.account_status !== AccountStatus.PENDING_VERIFICATION ||
      user.email_verified_at
    ) {
      throw new ForbiddenException(sysMsg.USER_INACTIVE);
    }
  }

  assertAdminTransition(
    current: AccountStatus,
    target: AccountStatus,
    actorRoles: readonly UserRole[],
    reason: string,
    hasVerifiedContact: boolean,
  ): void {
    this.assertKnownStatus(current);
    this.assertKnownStatus(target);
    if (!actorRoles.includes(UserRole.ADMIN) || !reason.trim()) {
      throw new ForbiddenException(
        'An administrator and a reason are required.',
      );
    }
    if (!ADMIN_TRANSITIONS[current].includes(target)) {
      throw new BadRequestException('Account state transition is not allowed.');
    }
    if (target === AccountStatus.ACTIVE && !hasVerifiedContact) {
      throw new BadRequestException(
        'Contact verification is required before activation.',
      );
    }
  }
}
