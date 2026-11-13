import { ValidationPipe } from '@nestjs/common';

import { ConsultationType } from '../../professional/entities/professional.entity';

import {
  normalizePublicSearchTerm,
  parsePublicCalendarDate,
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
});
