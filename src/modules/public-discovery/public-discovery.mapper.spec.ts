import {
  ConsultationType,
  Professional,
  ProfessionalVerificationStatus,
} from '../professional/entities/professional.entity';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

import { encodePublicAvailabilityCursor } from './public-discovery.cursor';
import {
  IPublicAvailabilitySlotSource,
  toPublicAvailabilityDays,
  toPublicIconIdentifier,
  toPublicImageUrl,
  toPublicPaginationMeta,
  toPublicProfessionalAvailability,
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

    expect(
      toPublicProfessionalDetail(createProfessional(), {
        rating: 4.5,
        total_reviews: 12,
      }),
    ).toEqual({
      ...summary,
      about: 'Consultant cardiologist',
    });
  });

  it('takes the detail review aggregate from the caller, not the stored summary', () => {
    const detail = toPublicProfessionalDetail(createProfessional(), {
      rating: 3.67,
      total_reviews: 3,
    });

    expect(detail).toMatchObject({ rating: 3.67, total_reviews: 3 });
  });

  it.each([
    ['<p>Consultant</p>'],
    ['Call me <script>alert(1)</script>'],
    ['a'.repeat(4001)],
    ['   '],
    [null],
    [undefined],
  ])('withholds the biography %p from the detail', (about) => {
    const professional = createProfessional();
    professional.about = about;

    expect(
      toPublicProfessionalDetail(professional, { rating: 0, total_reviews: 0 })
        .about,
    ).toBeNull();
  });

  it('publishes names and speciality names as single-line plain text', () => {
    const professional = createProfessional();
    professional.user.first_name = ' <b>Ada</b>\n';
    professional.user.last_name = 'Obi <script>';
    professional.speciality.name = 'Cardio<img src=x>logy';

    const summary = toPublicProfessionalSummary(professional);

    expect(summary.name).toBe('b>Ada/b> Obi script>');
    expect(summary.speciality.name).toBe('Cardioimg src=x>logy');
    expect(JSON.stringify(summary)).not.toMatch(/<[A-Za-z/!?]/);
  });

  it('publishes speciality text as plain text', () => {
    const speciality = createSpeciality();
    speciality.name = '  Heart   <i>care</i> ';
    speciality.description = 'Heart <b>care</b>';

    expect(toPublicSpeciality(speciality)).toMatchObject({
      name: 'Heart i>care/i>',
      description: null,
    });
  });

  it.each([
    ['summary', toPublicProfessionalSummary],
    [
      'detail',
      (professional: Professional) =>
        toPublicProfessionalDetail(professional, {
          rating: 4.5,
          total_reviews: 12,
        }),
    ],
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

  describe('availability', () => {
    // A row as the availability query returns it, with extra columns a
    // careless query could add, to prove the response is an allowlist.
    const slot = (
      id: string,
      date: string,
      start: string,
      startsAt: string,
      zone = 'Africa/Lagos',
    ): IPublicAvailabilitySlotSource =>
      ({
        id,
        date,
        start_time: start,
        end_time: '23:59:00',
        time_zone: zone,
        starts_at: new Date(startsAt),
        ends_at: new Date(new Date(startsAt).getTime() + 30 * 60_000),
        professional_id: 'internal-professional-id',
        is_available: true,
        booking_id: 'internal-booking-id',
        patient_id: 'internal-patient-id',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      }) as IPublicAvailabilitySlotSource;

    const rows = [
      slot('c', '2026-01-16', '09:00:00', '2026-01-16T08:00:00.000Z'),
      slot('b', '2026-01-15', '10:00:00', '2026-01-15T09:00:00.000Z'),
      slot('a', '2026-01-15', '09:00:00', '2026-01-15T08:00:00.000Z'),
    ];

    it('groups slots by local date in chronological order', () => {
      expect(toPublicAvailabilityDays(rows)).toEqual([
        {
          date: '2026-01-15',
          slots: [
            {
              id: 'a',
              start_time: '09:00:00',
              end_time: '23:59:00',
              time_zone: 'Africa/Lagos',
              starts_at: '2026-01-15T08:00:00.000Z',
              ends_at: '2026-01-15T08:30:00.000Z',
            },
            {
              id: 'b',
              start_time: '10:00:00',
              end_time: '23:59:00',
              time_zone: 'Africa/Lagos',
              starts_at: '2026-01-15T09:00:00.000Z',
              ends_at: '2026-01-15T09:30:00.000Z',
            },
          ],
        },
        {
          date: '2026-01-16',
          slots: [
            {
              id: 'c',
              start_time: '09:00:00',
              end_time: '23:59:00',
              time_zone: 'Africa/Lagos',
              starts_at: '2026-01-16T08:00:00.000Z',
              ends_at: '2026-01-16T08:30:00.000Z',
            },
          ],
        },
      ]);
    });

    it('produces the same result whatever order the rows arrive in', () => {
      expect(toPublicAvailabilityDays([...rows].reverse())).toEqual(
        toPublicAvailabilityDays(rows),
      );
    });

    it('orders slots by the instant they start, not by their local time', () => {
      const [day] = toPublicAvailabilityDays([
        // 09:00 in New York is later than 12:00 in Lagos on the same date.
        slot(
          'new-york',
          '2026-01-15',
          '09:00:00',
          '2026-01-15T14:00:00.000Z',
          'America/New_York',
        ),
        slot('lagos', '2026-01-15', '12:00:00', '2026-01-15T11:00:00.000Z'),
      ]);

      expect(
        day.slots.map((published) => [published.id, published.time_zone]),
      ).toEqual([
        ['lagos', 'Africa/Lagos'],
        ['new-york', 'America/New_York'],
      ]);
    });

    it('orders days by local date when zones interleave', () => {
      // 00:30 on the 20th in Kiritimati starts before 23:00 on the 19th
      // twelve hours behind UTC, yet its local date is later.
      const days = toPublicAvailabilityDays([
        slot(
          'kiritimati',
          '2031-05-20',
          '00:30:00',
          '2031-05-19T10:30:00.000Z',
          'Pacific/Kiritimati',
        ),
        slot(
          'behind',
          '2031-05-19',
          '23:00:00',
          '2031-05-20T11:00:00.000Z',
          'Etc/GMT+12',
        ),
      ]);

      expect(
        days.map((day) => [day.date, day.slots.map(({ id }) => id)]),
      ).toEqual([
        ['2031-05-19', ['behind']],
        ['2031-05-20', ['kiritimati']],
      ]);
    });

    it('breaks a tie between simultaneous slots by identifier', () => {
      const instant = '2026-01-15T08:00:00.000Z';
      const [day] = toPublicAvailabilityDays([
        slot('b', '2026-01-15', '09:00:00', instant),
        slot('a', '2026-01-15', '09:00:00', instant),
      ]);

      expect(day.slots.map(({ id }) => id)).toEqual(['a', 'b']);
    });

    it('publishes only the allowlisted slot fields', () => {
      const days = toPublicAvailabilityDays(rows);
      const serialized = JSON.stringify(days);

      days.forEach((day) => {
        expect(Object.keys(day).sort()).toEqual(['date', 'slots']);
        day.slots.forEach((published) =>
          expect(Object.keys(published).sort()).toEqual([
            'end_time',
            'ends_at',
            'id',
            'start_time',
            'starts_at',
            'time_zone',
          ]),
        );
      });
      ['internal-', 'is_available', 'professional_id', 'created_at'].forEach(
        (value) => expect(serialized).not.toContain(value),
      );
    });

    it('describes the range, the instant it was read, and its days', () => {
      const asOf = new Date('2026-01-14T10:30:00.000Z');

      expect(
        toPublicProfessionalAvailability(
          { from: '2026-01-15', to: '2026-01-21' },
          asOf,
          rows,
        ),
      ).toEqual({
        from: '2026-01-15',
        to: '2026-01-21',
        as_of: '2026-01-14T10:30:00.000Z',
        days: toPublicAvailabilityDays(rows),
        has_more: false,
        next_cursor: null,
      });
    });

    it('reports an empty range without days', () => {
      expect(
        toPublicProfessionalAvailability(
          { from: '2026-01-15', to: '2026-01-15' },
          new Date('2026-01-14T10:30:00.000Z'),
          [],
        ),
      ).toMatchObject({ days: [], has_more: false, next_cursor: null });
    });

    it('keeps the earliest slots and reports that later ones were left out', () => {
      const availability = toPublicProfessionalAvailability(
        { from: '2026-01-15', to: '2026-01-16' },
        new Date('2026-01-14T10:30:00.000Z'),
        rows,
        2,
      );

      expect(availability.has_more).toBe(true);
      expect(
        availability.days.flatMap((day) => day.slots.map(({ id }) => id)),
      ).toEqual(['a', 'b']);
      // The cursor names the last published slot, so the next page starts
      // right after it.
      expect(availability.next_cursor).toBe(
        encodePublicAvailabilityCursor({
          startsAt: new Date('2026-01-15T09:00:00.000Z'),
          id: 'b',
        }),
      );
    });

    it('reports nothing left out when the slots exactly fill the bound', () => {
      expect(
        toPublicProfessionalAvailability(
          { from: '2026-01-15', to: '2026-01-16' },
          new Date('2026-01-14T10:30:00.000Z'),
          rows,
          3,
        ),
      ).toMatchObject({ has_more: false, next_cursor: null });
    });
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
