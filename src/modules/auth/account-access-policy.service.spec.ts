import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

import { AccountAccessPolicyService } from './account-access-policy.service';

describe('AccountAccessPolicyService canonical state matrix', () => {
  const policy = new AccountAccessPolicyService();
  const user = (account_status: AccountStatus, verified = true) =>
    ({
      account_status,
      email_verified_at: verified ? new Date('2026-01-01') : null,
      // Deliberately contradictory legacy flags: they are not authoritative.
      is_active: account_status !== AccountStatus.ACTIVE,
      is_verified: !verified,
    }) as User;

  it.each(Object.values(AccountStatus))(
    'refuses credentials for %s unless active',
    (status) => {
      if (status === AccountStatus.ACTIVE) {
        expect(() => policy.assertCanAuthenticate(user(status))).not.toThrow();
      } else {
        expect(() => policy.assertCanAuthenticate(user(status))).toThrow(
          UnauthorizedException,
        );
      }
    },
  );

  it('rejects active users without a verified contact timestamp', () => {
    expect(() =>
      policy.assertCanAuthenticate(user(AccountStatus.ACTIVE, false)),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed on unknown and missing database states', () => {
    expect(() =>
      policy.assertCanAuthenticate(user('archived' as AccountStatus)),
    ).toThrow(UnauthorizedException);
    expect(() => policy.assertCanAuthenticate(null)).toThrow(
      UnauthorizedException,
    );
  });

  it('permits contact proof only for genuinely pending users', () => {
    expect(() =>
      policy.assertCanVerifyContact(
        user(AccountStatus.PENDING_VERIFICATION, false),
      ),
    ).not.toThrow();
    expect(() =>
      policy.assertCanVerifyContact(user(AccountStatus.SUSPENDED)),
    ).toThrow(ForbiddenException);
    expect(() =>
      policy.assertCanVerifyContact(user(AccountStatus.DEACTIVATED)),
    ).toThrow(ForbiddenException);
    expect(() =>
      policy.assertCanVerifyContact(user(AccountStatus.ACTIVE)),
    ).toThrow(BadRequestException);
  });

  it('allows only authorized, reasoned transitions and never bypasses email proof', () => {
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.ACTIVE,
        AccountStatus.SUSPENDED,
        [UserRole.ADMIN],
        'abuse report',
        true,
      ),
    ).not.toThrow();
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.SUSPENDED,
        AccountStatus.ACTIVE,
        [UserRole.ADMIN],
        'review completed',
        true,
      ),
    ).not.toThrow();
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.SUSPENDED,
        AccountStatus.ACTIVE,
        [UserRole.ADMIN],
        'review completed',
        false,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.DEACTIVATED,
        AccountStatus.ACTIVE,
        [UserRole.ADMIN],
        'request',
        true,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.ACTIVE,
        AccountStatus.SUSPENDED,
        [UserRole.PATIENT],
        'request',
        true,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.ACTIVE,
        AccountStatus.SUSPENDED,
        [UserRole.ADMIN],
        '',
        true,
      ),
    ).toThrow(ForbiddenException);
  });
});
