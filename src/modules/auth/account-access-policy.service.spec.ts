import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';

import { AccountAccessPolicyService } from './account-access-policy.service';

describe('AccountAccessPolicyService canonical state matrix', () => {
  const policy = new AccountAccessPolicyService();
  const user = (status: AccountStatus, verified = true) =>
    ({
      account_status: status,
      email_verified_at: verified ? new Date('2026-01-01') : null,
      // Deliberately contradictory legacy flags: they are not authoritative.
      is_active: status !== AccountStatus.ACTIVE,
      is_verified: !verified,
    }) as User;

  it('allows active accounts only when verification evidence exists', () => {
    expect(() =>
      policy.assertCanAuthenticate(user(AccountStatus.ACTIVE)),
    ).not.toThrow();
  });

  it.each([
    AccountStatus.PENDING_VERIFICATION,
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
  ])('denies credentials for %s', (status) => {
    expect(() => policy.assertCanAuthenticate(user(status))).toThrow(
      UnauthorizedException,
    );
  });

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
        true,
        'abuse report',
        true,
      ),
    ).not.toThrow();
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.SUSPENDED,
        AccountStatus.ACTIVE,
        true,
        'review completed',
        true,
      ),
    ).not.toThrow();
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.SUSPENDED,
        AccountStatus.ACTIVE,
        true,
        'review completed',
        false,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.DEACTIVATED,
        AccountStatus.ACTIVE,
        true,
        'request',
        true,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.ACTIVE,
        AccountStatus.SUSPENDED,
        false,
        'request',
        true,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      policy.assertAdminTransition(
        AccountStatus.ACTIVE,
        AccountStatus.SUSPENDED,
        true,
        '',
        true,
      ),
    ).toThrow(ForbiddenException);
  });
});
