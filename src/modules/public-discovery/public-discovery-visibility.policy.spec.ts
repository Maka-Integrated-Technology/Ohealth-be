import { SelectQueryBuilder } from 'typeorm';

import {
  Professional,
  ProfessionalVerificationStatus,
} from '../professional/entities/professional.entity';
import { AccountStatus } from '../user/enums/account-status.enum';

import {
  PublicDiscoveryVisibilityPolicy,
  PublicProfessionalVisibilityState,
} from './public-discovery-visibility.policy';

describe('PublicDiscoveryVisibilityPolicy', () => {
  const policy = new PublicDiscoveryVisibilityPolicy();

  const visibleProfessional = (): PublicProfessionalVisibilityState => ({
    is_active: true,
    verification_status: ProfessionalVerificationStatus.VERIFIED,
    user: {
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
    },
    speciality: { is_active: true },
  });

  describe('specialities', () => {
    it('shows an active speciality', () => {
      expect(policy.isSpecialityVisible({ is_active: true })).toBe(true);
    });

    it.each([
      ['inactive', { is_active: false }],
      ['missing', null],
      ['undefined', undefined],
      ['truthy but not true', { is_active: 'true' as unknown as boolean }],
    ])('hides a speciality that is %s', (_label, speciality) => {
      expect(policy.isSpecialityVisible(speciality)).toBe(false);
    });
  });

  describe('professionals', () => {
    it('shows an active, approved professional with an active verified account', () => {
      expect(policy.isProfessionalVisible(visibleProfessional())).toBe(true);
    });

    it.each<[string, (state: PublicProfessionalVisibilityState) => void]>([
      ['the profile is inactive', (state) => (state.is_active = false)],
      [
        'verification is pending',
        (state) =>
          (state.verification_status = ProfessionalVerificationStatus.PENDING),
      ],
      [
        'verification is rejected',
        (state) =>
          (state.verification_status = ProfessionalVerificationStatus.REJECTED),
      ],
      [
        'verification is an unknown value',
        (state) =>
          (state.verification_status =
            'approved' as ProfessionalVerificationStatus),
      ],
      [
        'the account is pending verification',
        (state) =>
          (state.user.account_status = AccountStatus.PENDING_VERIFICATION),
      ],
      [
        'the account is suspended',
        (state) => (state.user.account_status = AccountStatus.SUSPENDED),
      ],
      [
        'the account is deactivated',
        (state) => (state.user.account_status = AccountStatus.DEACTIVATED),
      ],
      [
        'the account status is unknown',
        (state) => (state.user.account_status = 'archived' as AccountStatus),
      ],
      [
        'the account contact is unverified',
        (state) => (state.user.email_verified_at = null),
      ],
      ['the account was not loaded', (state) => (state.user = undefined)],
      [
        'the speciality is inactive',
        (state) => (state.speciality = { is_active: false }),
      ],
      [
        'the speciality was not loaded',
        (state) => (state.speciality = undefined),
      ],
    ])('hides a professional when %s', (_label, mutate) => {
      const state = visibleProfessional();
      mutate(state);
      expect(policy.isProfessionalVisible(state)).toBe(false);
    });

    it.each([null, undefined])('hides a %s professional', (value) => {
      expect(policy.isProfessionalVisible(value)).toBe(false);
    });
  });

  describe('query predicates', () => {
    const createQuery = () => {
      const conditions: Array<[string, Record<string, unknown> | undefined]> =
        [];
      const query = {
        andWhere: jest.fn(
          (condition: string, parameters?: Record<string, unknown>) => {
            conditions.push([condition, parameters]);
            return query;
          },
        ),
      };
      return {
        query: query as unknown as SelectQueryBuilder<Professional>,
        conditions,
      };
    };

    it('requires an active speciality', () => {
      const { query, conditions } = createQuery();

      expect(policy.applySpecialityVisibility(query, 's')).toBe(query);
      expect(conditions).toEqual([
        [
          's.is_active = :publicSpecialityActive',
          { publicSpecialityActive: true },
        ],
      ]);
    });

    it('requires every professional visibility condition with bound parameters', () => {
      const { query, conditions } = createQuery();

      expect(
        policy.applyProfessionalVisibility(query, {
          professional: 'p',
          user: 'u',
          speciality: 's',
        }),
      ).toBe(query);
      expect(conditions).toEqual([
        [
          'p.is_active = :publicProfessionalActive',
          { publicProfessionalActive: true },
        ],
        [
          'p.verification_status = :publicProfessionalStatus',
          { publicProfessionalStatus: 'verified' },
        ],
        [
          'u.account_status = :publicAccountStatus',
          { publicAccountStatus: 'active' },
        ],
        ['u.email_verified_at IS NOT NULL', undefined],
        [
          's.is_active = :publicSpecialityActive',
          { publicSpecialityActive: true },
        ],
      ]);
    });
  });
});
