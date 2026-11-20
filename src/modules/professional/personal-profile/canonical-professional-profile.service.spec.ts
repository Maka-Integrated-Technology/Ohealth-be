import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../../auth/account-access-policy.service';
import { AuthContextService } from '../../auth/context/auth-context.service';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';

import { CanonicalProfessionalProfileService } from './canonical-professional-profile.service';

describe('CanonicalProfessionalProfileService', () => {
  const user = {
    id: 'professional-owner',
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    first_name: 'Ada',
    last_name: 'Okafor',
    middle_name: null,
    gender: null,
    dob: null,
    country: null,
    updated_at: new Date(),
  };
  const manager = {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    update: jest.fn(),
  };
  const users = { manager: { transaction: jest.fn() } };
  const context = { assertCapabilities: jest.fn() };
  const service = new CanonicalProfessionalProfileService(
    users as unknown as Repository<User>,
    context as unknown as AuthContextService,
    new AccountAccessPolicyService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    users.manager.transaction.mockImplementation(
      (callback: (manager: unknown) => unknown) => callback(manager),
    );
    manager.findOne.mockImplementation((entity: unknown) =>
      entity === User ? { ...user } : { user_id: user.id, is_active: true },
    );
    manager.findOneByOrFail.mockResolvedValue({ ...user, first_name: 'Amaka' });
  });

  it('normalizes and updates only the authenticated professional user', async () => {
    const result = await service.update(user.id, 'session', {
      first_name: ' Amaka ',
    });
    expect(context.assertCapabilities).toHaveBeenCalledWith(
      user.id,
      'session',
      ['account.profile.update', 'persona.professional'],
    );
    expect(manager.findOne).toHaveBeenCalledWith(User, {
      where: { id: user.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.findOne).toHaveBeenCalledWith(UserPersona, {
      where: {
        user_id: user.id,
        persona_type: 'healthcare_professional',
        is_active: true,
      },
      lock: { mode: 'pessimistic_read' },
    });
    expect(manager.update).toHaveBeenCalledWith(User, user.id, {
      first_name: 'Amaka',
    });
    expect(result.first_name).toBe('Amaka');
    expect(result).not.toHaveProperty('role');
  });

  it('does not write an identical update', async () => {
    await service.update(user.id, 'session', { first_name: 'Ada' });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('shares patient normalization for every person-wide field', async () => {
    await service.update(user.id, 'session', {
      first_name: ' Amaka ',
      last_name: ' Bello ',
      middle_name: ' ',
      gender: 'Female',
      dob: '2000-01-15',
      country: ' Nigeria ',
    });
    expect(manager.update).toHaveBeenCalledWith(User, user.id, {
      first_name: 'Amaka',
      last_name: 'Bello',
      gender: 'Female',
      dob: '2000-01-15',
      country: 'Nigeria',
    });
  });

  it.each([
    'address',
    'user_id',
    'persona',
    'role',
    'verification_status',
    'speciality_id',
    'consultation_fee',
    'organization_id',
    'image',
    'phone',
    'password',
  ])('rejects protected field %s before a transaction', async (field) => {
    await expect(
      service.update(user.id, 'session', { [field]: 'malicious' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(users.manager.transaction).not.toHaveBeenCalled();
  });

  it.each([
    AccountStatus.SUSPENDED,
    AccountStatus.DEACTIVATED,
    AccountStatus.PENDING_VERIFICATION,
  ])('fails closed for %s account', async (status) => {
    manager.findOne.mockImplementation((entity: unknown) =>
      entity === User
        ? { ...user, account_status: status }
        : { is_active: true },
    );
    await expect(
      service.update(user.id, 'session', { first_name: 'New' }),
    ).rejects.toThrow();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown disabled account state', async () => {
    manager.findOne.mockImplementation((entity: unknown) =>
      entity === User
        ? { ...user, account_status: 'disabled' }
        : { is_active: true },
    );
    await expect(
      service.update(user.id, 'session', { first_name: 'New' }),
    ).rejects.toThrow();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('fails closed when the professional persona is removed', async () => {
    manager.findOne.mockImplementation((entity: unknown) =>
      entity === User ? { ...user } : null,
    );
    await expect(
      service.update(user.id, 'session', { first_name: 'New' }),
    ).rejects.toThrow(ForbiddenException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('denies a patient without professional capability', async () => {
    context.assertCapabilities.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      service.update(user.id, 'session', { first_name: 'New' }),
    ).rejects.toThrow(ForbiddenException);
    expect(users.manager.transaction).not.toHaveBeenCalled();
  });
});
