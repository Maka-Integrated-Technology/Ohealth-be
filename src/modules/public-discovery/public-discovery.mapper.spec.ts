import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import {
  ConsultationType,
  Professional,
  ProfessionalVerificationStatus,
} from '../professional/entities/professional.entity';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

import {
  toPublicAvailabilityDays,
  toPublicIconIdentifier,
  toPublicImageUrl,
  toPublicPaginationMeta,
  toPublicProfessionalDetail,
  toPublicProfessionalSummary,
  toPublicSpeciality,
} from './public-discovery.mapper';

const PRIVATE_VALUES = [
  'private@example.com',
  '+2348000000000',
  '1990-04-12',
  'LIC-PRIVATE-001',
  'password-hash-value',
  'google-subject-id',
  'reset-token-value',
  '123456',
];

function createSpeciality(): Speciality {
  return Object.assign(new Speciality(), {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Cardiology',
    description: 'Heart care',
    icon: 'general-doctor',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  });
}

function createProfessional(): Professional {
  const user = Object.assign(new User(), {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'private@example.com',
    password: 'password-hash-value',
    first_name: ' Ada ',
    last_name: 'Obi',
    dob: '1990-04-12',
    phone: '+2348000000000',
    country: 'NG',
    role: [UserRole.DOCTOR],
    is_active: true,
    is_verified: true,
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
    verification_code: '123456',
    google_id: 'google-subject-id',
    reset_token: 'reset-token-value',
  });

  return Object.assign(new Professional(), {
    id: '33333333-3333-4333-8333-333333333333',
    user,
    user_id: user.id,
    speciality: createSpeciality(),
    speciality_id: '11111111-1111-4111-8111-111111111111',
    image: 'https://cdn.example.com/ada.png',
    about: 'Consultant cardiologist',
    license_number: 'LIC-PRIVATE-001',
    years_of_experience: 8,
    consultation_fee: '5000.00' as unknown as number,
    rating: '4.50' as unknown as number,
    total_reviews: 12,
    consultation_type: ConsultationType.BOTH,
    is_available: true,
    is_active: true,
    verification_status: ProfessionalVerificationStatus.VERIFIED,
    profile_setup_completed: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('public discovery mapper', () => {
  it('publishes only the allowlisted speciality fields', () => {
    expect(toPublicSpeciality(createSpeciality())).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Cardiology',
      description: 'Heart care',
      icon: 'general-doctor',
    });
  });

  it('represents absent optional speciality fields as null', () => {
    const speciality = createSpeciality();
    speciality.description = undefined;
    speciality.icon = undefined;

    expect(toPublicSpeciality(speciality)).toMatchObject({
      description: null,
      icon: null,
    });
  });

  it.each([['nurse'], ['general-doctor'], ['icon-2'], ['a'.repeat(64)]])(
    'publishes the icon asset identifier %p',
    (value) => {
      expect(toPublicIconIdentifier(value)).toBe(value);
    },
  );

  it.each([
    ['heart.png'],
    ['specialities/11/icon.png'],
    ['/uploads/icons/heart.png'],
    ['../icons/heart'],
    ['icons\\heart'],
    ['https://cdn.example.com/heart.png'],
    ['http://cdn.example.com/heart.png'],
    ['s3://private-bucket/icons/heart.png'],
    ['data:image/png;base64,AAAA'],
    ['javascript:alert(1)'],
    ['General-Doctor'],
    ['general_doctor'],
    ['general doctor'],
    [' nurse'],
    ['nurse\n'],
    ['-nurse'],
    ['nurse-'],
    ['general--doctor'],
    ['a'.repeat(65)],
    [''],
    [null],
    [undefined],
  ])('withholds the non-public icon value %p', (value) => {
    expect(toPublicIconIdentifier(value)).toBeNull();
  });

  it('withholds a stored icon that is not an asset identifier', () => {
    const speciality = createSpeciality();
    speciality.icon = 'specialities/11/icon.png';

    expect(toPublicSpeciality(speciality).icon).toBeNull();
  });

  it('publishes only the allowlisted professional summary fields', () => {
    expect(toPublicProfessionalSummary(createProfessional())).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Ada Obi',
      image: 'https://cdn.example.com/ada.png',
      speciality: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Cardiology',
      },
      rating: 4.5,
      total_reviews: 12,
      consultation_fee: 5000,
      years_of_experience: 8,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
    });
  });

  it('adds only the biography to the professional detail', () => {
    const summary = toPublicProfessionalSummary(createProfessional());

    expect(toPublicProfessionalDetail(createProfessional())).toEqual({
      ...summary,
      about: 'Consultant cardiologist',
    });
  });

  it.each([
    ['summary', toPublicProfessionalSummary],
    ['detail', toPublicProfessionalDetail],
  ])(
    'never serializes private account or licence data in the %s',
    (_l, map) => {
      const serialized = JSON.stringify(map(createProfessional()));

      PRIVATE_VALUES.forEach((value) =>
        expect(serialized).not.toContain(value),
      );
      [
        'email',
        'phone',
        'dob',
        'license_number',
        'verification_status',
        'account_status',
        'role',
        'user_id',
        'user',
        'is_active',
        'profile_setup_completed',
        'created_at',
      ].forEach((field) => expect(serialized).not.toContain(`"${field}"`));
    },
  );

  it.each([
    ['professionals/33/avatar.png'],
    ['/uploads/avatar.png'],
    ['http://cdn.example.com/avatar.png'],
    ['s3://private-bucket/avatar.png'],
    ['https://user:secret@cdn.example.com/avatar.png'],
    ['javascript:alert(1)'],
    [''],
    [null],
    [undefined],
  ])('withholds the non-public image value %p', (value) => {
    expect(toPublicImageUrl(value)).toBeNull();
  });

  it('groups availability by day in date and start-time order', () => {
    const slot = (
      id: string,
      date: string,
      start: string,
      end: string,
    ): ProfessionalAvailability =>
      Object.assign(new ProfessionalAvailability(), {
        id,
        professional_id: 'internal-professional-id',
        date,
        start_time: start,
        end_time: end,
        is_available: true,
      });

    expect(
      toPublicAvailabilityDays([
        slot('c', '2026-01-16', '09:00:00', '09:30:00'),
        slot('b', '2026-01-15', '10:00:00', '10:30:00'),
        slot('a', '2026-01-15', '09:00:00', '09:30:00'),
      ]),
    ).toEqual([
      {
        date: '2026-01-15',
        slots: [
          { id: 'a', start_time: '09:00:00', end_time: '09:30:00' },
          { id: 'b', start_time: '10:00:00', end_time: '10:30:00' },
        ],
      },
      {
        date: '2026-01-16',
        slots: [{ id: 'c', start_time: '09:00:00', end_time: '09:30:00' }],
      },
    ]);
  });

  it.each([
    [1, 20, 0, { total_pages: 0, has_next: false, has_previous: false }],
    [1, 20, 20, { total_pages: 1, has_next: false, has_previous: false }],
    [1, 20, 21, { total_pages: 2, has_next: true, has_previous: false }],
    [2, 20, 21, { total_pages: 2, has_next: false, has_previous: true }],
  ])(
    'describes page %d of limit %d over %d rows',
    (page, limit, total, meta) => {
      expect(toPublicPaginationMeta(page, limit, total)).toEqual({
        page,
        limit,
        total,
        ...meta,
      });
    },
  );
});
