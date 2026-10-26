import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../../auth/account-access-policy.service';
import { CanonicalAuthContextService } from '../../auth/context/canonical-auth-context.service';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { PatientProfile } from '../entities/patient-profile.entity';

import { CanonicalPatientProfileService } from './canonical-patient-profile.service';

describe('CanonicalPatientProfileService', () => {
  const user = {
    id: 'current-session-owner',
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    first_name: 'Ada',
    last_name: 'Okafor',
    middle_name: null,
    gender: null,
    dob: null,
    country: null,
  };
  const userRepository = {
    findOne: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const profileRepository = { findOne: jest.fn() };
  const canonical = { assertCanEditPatientProfile: jest.fn() };
  const manager = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => ({
      ...value,
      id: 'profile-row-id',
    })),
  };
  const service = new CanonicalPatientProfileService(
    userRepository as unknown as Repository<User>,
    profileRepository as unknown as Repository<PatientProfile>,
    canonical as unknown as CanonicalAuthContextService,
    new AccountAccessPolicyService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue({ ...user });
    profileRepository.findOne.mockResolvedValue({
      user_id: user.id,
      address: '12 Example Road',
    });
    canonical.assertCanEditPatientProfile.mockResolvedValue(undefined);
    (userRepository.manager.transaction as jest.Mock).mockImplementation(
      async (callback: (manager: unknown) => Promise<unknown>) =>
        callback(manager),
    );
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === User) return { ...user };
      if (entity === PatientProfile) {
        return {
          user_id: user.id,
          id: 'profile-row-id',
          address: '12 Example Road',
        };
      }
      return { user_id: user.id, persona_type: 'patient', is_active: true };
    });
  });

  it('returns only canonical personal data for the authenticated owner', async () => {
    const response = await service.get(user.id);
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: user.id },
    });
    expect(response).toMatchObject({
      user_id: user.id,
      first_name: 'Ada',
      address: '12 Example Road',
    });
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('role');
    expect(response).not.toHaveProperty('medical_conditions');
  });

  it('updates only permitted fields in one transaction', async () => {
    const result = await service.update(user.id, {
      first_name: 'Amaka',
      address: 'New Street',
    });
    expect(manager.update).toHaveBeenCalledWith(User, user.id, {
      first_name: 'Amaka',
    });
    expect(manager.update).toHaveBeenCalledWith(
      PatientProfile,
      'profile-row-id',
      { address: 'New Street' },
    );
    expect(result.first_name).toBe('Amaka');
    expect(result.address).toBe('New Street');
  });

  it('does not write unchanged data', async () => {
    await service.update(user.id, {
      first_name: 'Ada',
      address: '12 Example Road',
    });
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('does not allow an unverified persona or suspended account to mutate data', async () => {
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === User) return { ...user };
      return null;
    });
    await expect(
      service.update(user.id, { first_name: 'Unauthorized' }),
    ).rejects.toThrow(ForbiddenException);
    expect(manager.update).not.toHaveBeenCalled();

    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === User) {
        return { ...user, account_status: AccountStatus.SUSPENDED };
      }
      return { user_id: user.id };
    });
    await expect(
      service.update(user.id, { first_name: 'Unauthorized' }),
    ).rejects.toThrow();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('does not allow security/contact mutation through this boundary', async () => {
    await expect(
      service.update(user.id, { phone: '+234000000' } as never),
    ).rejects.toThrow();
    expect(userRepository.manager.transaction).not.toHaveBeenCalled();
  });
});
