import { UnauthorizedException } from '@nestjs/common';

import { TwoFactorAuthService } from './two-factor-auth.service';

describe('MFA denial audit boundary', () => {
  it('persists a denied confirmation after the factor transaction rolls back', async () => {
    const transaction = jest
      .fn()
      .mockRejectedValue(new UnauthorizedException('Invalid MFA code.'));
    const recordAttempt = jest.fn().mockResolvedValue(undefined);
    const service = new TwoFactorAuthService(
      { transaction } as never,
      {} as never,
      {} as never,
      { recordAttempt } as never,
      {} as never,
    );
    const userId = '550e8400-e29b-41d4-a716-446655440000';

    await expect(service.confirm2fa(userId, '000000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(recordAttempt).toHaveBeenCalledWith({
      event_type: 'mfa_activated',
      outcome: 'denied',
      actor_user_id: userId,
      subject_user_id: userId,
    });
  });

  it('does not hide an unavailable audit store after a denied operation', async () => {
    const transaction = jest
      .fn()
      .mockRejectedValue(new UnauthorizedException('Invalid MFA code.'));
    const recordAttempt = jest.fn().mockRejectedValue(new Error('audit down'));
    const service = new TwoFactorAuthService(
      { transaction } as never,
      {} as never,
      {} as never,
      { recordAttempt } as never,
      {} as never,
    );

    await expect(
      service.confirm2fa('550e8400-e29b-41d4-a716-446655440000', '000000'),
    ).rejects.toThrow('audit down');
  });
});
