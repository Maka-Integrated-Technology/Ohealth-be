import { env } from 'node:process';

import { ValidationPipe } from '@nestjs/common';

import { ConsultationType } from '../../professional/entities/professional.entity';

import {
  isPublicCalendarDateOver,
  normalizePublicSearchTerm,
  parsePublicCalendarDate,
  parsePublicFeeAmount,
  PublicDateRangeQueryDto,
  PublicPaginationQueryDto,
  PublicProfessionalDirectoryQueryDto,
  PublicSearchQueryDto,
} from './public-discovery-query.dto';

type QueryDto = new () => object;

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function parse<T>(metatype: new () => T, query: Record<string, unknown>) {
  return pipe.transform(query, { type: 'query', metatype }) as Promise<T>;
}

async function messages(metatype: QueryDto, query: Record<string, unknown>) {
  try {
    await parse(metatype, query);
  } catch (error) {
    return (error as { getResponse(): { message: string[] } }).getResponse()
      .message;
  }
  throw new Error('Expected the query to be rejected');
}

describe('public discovery query DTOs', () => {
  describe('pagination', () => {
    it('applies the default page and limit', async () => {
      await expect(parse(PublicPaginationQueryDto, {})).resolves.toEqual({
        page: 1,
        limit: 20,
      });
    });

    it('converts numeric query strings', async () => {
      await expect(
        parse(PublicPaginationQueryDto, { page: '3', limit: '50' }),
      ).resolves.toEqual({ page: 3, limit: 50 });
    });

    it.each([
      [{ limit: '51' }, ['limit must be an integer between 1 and 50']],
      [{ limit: '0' }, ['limit must be an integer between 1 and 50']],
      [{ page: '0' }, ['page must be an integer between 1 and 1000']],
      [{ page: '1001' }, ['page must be an integer between 1 and 1000']],
      [{ page: '1.5' }, ['page must be an integer between 1 and 1000']],
      [{ page: ['1', '2'] }, ['page must be an integer between 1 and 1000']],
      [
        { page: 'abc', limit: 'abc' },
        [
          'page must be an integer between 1 and 1000',
          'limit must be an integer between 1 and 50',
        ],
      ],
      [{ offset: '10' }, ['property offset should not exist']],
    ])('rejects %p with deterministic messages', async (query, expected) => {
      await expect(messages(PublicPaginationQueryDto, query)).resolves.toEqual(
        expected,
      );
    });
  });

  describe('search', () => {
    it('normalizes whitespace and compatibility characters', async () => {
      const result = await parse(PublicSearchQueryDto, {
        q: '  Ｃardio \t  logy  ',
      });

      expect(result.q).toBe('Cardio logy');
    });

    it('treats a blank term as no search', async () => {
      const result = await parse(PublicSearchQueryDto, { q: '   ' });

      expect(result.q).toBeUndefined();
    });

    it.each([
      [{ q: 'a' }, ['q must be text between 2 and 100 characters']],
      [{ q: 'a'.repeat(101) }, ['q must be text between 2 and 100 characters']],
      [
        { q: ['cardio', 'derma'] },
        ['q must be text between 2 and 100 characters'],
      ],
    ])('rejects %p', async (query, expected) => {
      await expect(messages(PublicSearchQueryDto, query)).resolves.toEqual(
        expected,
      );
    });

    it('leaves non-text values for validation to reject', () => {
      expect(normalizePublicSearchTerm(42)).toBe(42);
    });
  });

  describe('professional directory', () => {
    it('applies the default sort', async () => {
      await expect(
        parse(PublicProfessionalDirectoryQueryDto, {}),
      ).resolves.toEqual({ page: 1, limit: 20, sort: 'rating', order: 'desc' });
    });

    it('accepts every allowlisted filter and sort', async () => {
      await expect(
        parse(PublicProfessionalDirectoryQueryDto, {
          q: 'ada',
          speciality_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          consultation_type: 'video',
          sort: 'consultation_fee',
          order: 'asc',
        }),
      ).resolves.toEqual({
        page: 1,
        limit: 20,
        q: 'ada',
        speciality_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        consultation_type: ConsultationType.VIDEO,
        sort: 'consultation_fee',
        order: 'asc',
      });
    });

    it.each([
      [
        { sort: 'license_number' },
        ['sort must be one of: rating, experience, consultation_fee, name'],
      ],
      [
        { sort: 'rating; DROP TABLE users' },
        ['sort must be one of: rating, experience, consultation_fee, name'],
      ],
      [{ order: 'DESC' }, ['order must be one of: asc, desc']],
      [{ speciality_id: '12' }, ['speciality_id must be a UUID']],
      [
        { consultation_type: 'in_person' },
        ['consultation_type must be one of: chat, video, both'],
      ],
      [{ role: 'admin' }, ['property role should not exist']],
      [
        { verification_status: 'pending' },
        ['property verification_status should not exist'],
      ],
    ])('rejects %p', async (query, expected) => {
      await expect(
        messages(PublicProfessionalDirectoryQueryDto, query),
      ).resolves.toEqual(expected);
    });
  });

  describe('consultation fee bounds', () => {
    it.each([
      [{ min_fee: '0' }, { min_fee: 0 }],
      [{ min_fee: '1500.5' }, { min_fee: 1500.5 }],
      [{ max_fee: '99999999.99' }, { max_fee: 99999999.99 }],
      [
        { min_fee: '3000', max_fee: '3000' },
        { min_fee: 3000, max_fee: 3000 },
      ],
      [
        { min_fee: '10.25', max_fee: '10.26' },
        { min_fee: 10.25, max_fee: 10.26 },
      ],
    ])('accepts the bounds %p', async (query, expected) => {
      await expect(
        parse(PublicProfessionalDirectoryQueryDto, query),
      ).resolves.toMatchObject(expected);
    });

    it.each([
      ['-1'],
      ['+5'],
      ['1e3'],
      ['1,000'],
      ['10.999'],
      ['100000000'],
      ['0x10'],
      ['Infinity'],
      ['NaN'],
      ['abc'],
      [''],
      [' 5'],
      ['5 OR 1=1'],
      [['1', '2']],
    ])('rejects the fee value %p with one stable message', async (value) => {
      await expect(
        messages(PublicProfessionalDirectoryQueryDto, { min_fee: value }),
      ).resolves.toEqual([
        'min_fee must be an amount between 0 and 99999999.99 with at most 2 decimal places',
      ]);
      await expect(
        messages(PublicProfessionalDirectoryQueryDto, { max_fee: value }),
      ).resolves.toEqual([
        'max_fee must be an amount between 0 and 99999999.99 with at most 2 decimal places',
      ]);
    });

    it('rejects a maximum below the minimum with one range message', async () => {
      await expect(
        messages(PublicProfessionalDirectoryQueryDto, {
          min_fee: '5000',
          max_fee: '4999.99',
        }),
      ).resolves.toEqual(['max_fee must be greater than or equal to min_fee']);
    });

    it('reports only the invalid bound when the other is valid', async () => {
      await expect(
        messages(PublicProfessionalDirectoryQueryDto, {
          min_fee: 'abc',
          max_fee: '10',
        }),
      ).resolves.toEqual([
        'min_fee must be an amount between 0 and 99999999.99 with at most 2 decimal places',
      ]);
    });

    it('leaves values that are not plain amounts for validation', () => {
      expect(parsePublicFeeAmount('12.50')).toBe(12.5);
      expect(parsePublicFeeAmount('1e3')).toBe('1e3');
      expect(parsePublicFeeAmount(12)).toBe(12);
      expect(parsePublicFeeAmount(undefined)).toBeUndefined();
    });
  });

  describe('date range', () => {
    it('accepts a single day and the maximum inclusive range', async () => {
      await expect(
        parse(PublicDateRangeQueryDto, {
          from: '2026-01-15',
          to: '2026-01-15',
        }),
      ).resolves.toEqual({ from: '2026-01-15', to: '2026-01-15' });
      await expect(
        parse(PublicDateRangeQueryDto, {
          from: '2026-01-01',
          to: '2026-01-31',
        }),
      ).resolves.toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    it.each([
      [
        { from: '2026-01-01', to: '2026-02-01' },
        ['to must be on or after from and cover at most 31 days'],
      ],
      [
        { from: '2026-01-15', to: '2026-01-14' },
        ['to must be on or after from and cover at most 31 days'],
      ],
      [
        { from: '2026-02-30', to: '2026-03-01' },
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        { from: '2026-01-15', to: '15/01/2026' },
        ['to must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        { from: '2026-01-15T00:00:00Z', to: '2026-01-16' },
        ['from must be a valid calendar date in YYYY-MM-DD format'],
      ],
      [
        {},
        [
          'from must be a valid calendar date in YYYY-MM-DD format',
          'to must be a valid calendar date in YYYY-MM-DD format',
        ],
      ],
    ])('rejects %p', async (query, expected) => {
      await expect(messages(PublicDateRangeQueryDto, query)).resolves.toEqual(
        expected,
      );
    });

    it('recognizes leap days only in leap years', () => {
      expect(parsePublicCalendarDate('2028-02-29')).not.toBeNull();
      expect(parsePublicCalendarDate('2026-02-29')).toBeNull();
    });
  });

  describe('a date that is over everywhere', () => {
    // 2026-01-15 ends last in the zone twelve hours behind UTC, at
    // 2026-01-16T12:00:00Z.
    it.each([
      ['2026-01-15', '2026-01-15T00:00:00.000Z', false],
      ['2026-01-15', '2026-01-16T11:59:59.999Z', false],
      ['2026-01-15', '2026-01-16T12:00:00.000Z', true],
      ['2026-01-15', '2026-01-17T00:00:00.000Z', true],
      // Still to come, including in the zone furthest ahead of UTC.
      ['2026-01-16', '2026-01-15T09:59:59.999Z', false],
      ['2027-01-15', '2026-01-16T12:00:00.000Z', false],
      ['2025-12-31', '2026-01-01T12:00:00.000Z', true],
    ])('reports whether %s is over at %s', (date, now, expected) => {
      expect(isPublicCalendarDateOver(date, new Date(now))).toBe(expected);
    });

    it.each([['15/01/2026'], ['2026-02-30'], [undefined], [20260115]])(
      'does not call the invalid date %p over',
      (value) => {
        expect(
          isPublicCalendarDateOver(value, new Date('2030-01-01T00:00:00Z')),
        ).toBe(false);
      },
    );

    it('gives the same answer in every server time zone', () => {
      const original = env.TZ;
      const answers = ['Pacific/Kiritimati', 'Etc/GMT+12', 'UTC'].map(
        (zone) => {
          env.TZ = zone;
          return [
            isPublicCalendarDateOver(
              '2026-01-15',
              new Date('2026-01-16T11:59:59.999Z'),
            ),
            isPublicCalendarDateOver(
              '2026-01-15',
              new Date('2026-01-16T12:00:00.000Z'),
            ),
          ];
        },
      );
      if (original === undefined) delete env.TZ;
      else env.TZ = original;

      expect(answers).toEqual([
        [false, true],
        [false, true],
        [false, true],
      ]);
    });
  });
});
