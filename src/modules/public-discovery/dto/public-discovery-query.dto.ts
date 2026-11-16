import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsUUID,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { ConsultationType } from '../../professional/entities/professional.entity';
import {
  PUBLIC_DISCOVERY_DEFAULT_SORT,
  PUBLIC_DISCOVERY_FEE,
  PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS,
  PUBLIC_DISCOVERY_PAGINATION,
  PUBLIC_DISCOVERY_SEARCH,
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../public-discovery.constants';

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FEE_AMOUNT_PATTERN = new RegExp(
  `^\\d{1,8}(?:\\.\\d{1,${PUBLIC_DISCOVERY_FEE.maxDecimalPlaces}})?$`,
);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Canonical form of a public search term: Unicode-normalized, trimmed, and
 * with internal whitespace collapsed. A blank term means "no search".
 */
export function normalizePublicSearchTerm(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return normalized.length === 0 ? undefined : normalized;
}

/** UTC day number of a strict `YYYY-MM-DD` calendar date, or null if invalid. */
export function parsePublicCalendarDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;

  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isRealDate ? timestamp / MILLISECONDS_PER_DAY : null;
}

/**
 * Reads a fee amount written as plain digits with at most two decimal places.
 * Anything else, including signs, exponents, and separators, is left as it
 * was received so validation rejects it.
 */
export function parsePublicFeeAmount(value: unknown): unknown {
  if (typeof value !== 'string' || !FEE_AMOUNT_PATTERN.test(value)) {
    return value;
  }
  return Number(value);
}

/** One bounded-integer rule per field so a bad value yields one message. */
const IsBoundedInteger =
  (
    minimum: number,
    maximum: number,
    options?: ValidationOptions,
  ): PropertyDecorator =>
  (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isBoundedInteger',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [minimum, maximum],
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= minimum &&
          value <= maximum,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be an integer between ${minimum} and ${maximum}`,
      },
    });
  };

const IsPublicSearchTerm =
  (options?: ValidationOptions): PropertyDecorator =>
  (target: object, propertyName: string | symbol) => {
    const { minLength, maxLength } = PUBLIC_DISCOVERY_SEARCH;
    registerDecorator({
      name: 'isPublicSearchTerm',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          value.length >= minLength &&
          value.length <= maxLength,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be text between ${minLength} and ${maxLength} characters`,
      },
    });
  };

const IsPublicCalendarDate =
  (options?: ValidationOptions): PropertyDecorator =>
  (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isPublicCalendarDate',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: (value: unknown) => parsePublicCalendarDate(value) !== null,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid calendar date in YYYY-MM-DD format`,
      },
    });
  };

const isPublicFeeAmount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= PUBLIC_DISCOVERY_FEE.minimum &&
  value <= PUBLIC_DISCOVERY_FEE.maximum;

/**
 * A fee bound. When `lowerBoundProperty` is given and both bounds are valid
 * amounts, this bound must also not be below it; the range message replaces
 * the amount message so each parameter still reports exactly one problem.
 */
const IsPublicFeeAmount =
  (
    lowerBoundProperty?: string,
    options?: ValidationOptions,
  ): PropertyDecorator =>
  (target: object, propertyName: string | symbol) => {
    const isBelowLowerBound = (value: unknown, args: ValidationArguments) => {
      if (!lowerBoundProperty || !isPublicFeeAmount(value)) return false;
      const lowerBound = (args.object as Record<string, unknown>)[
        lowerBoundProperty
      ];
      return isPublicFeeAmount(lowerBound) && value < lowerBound;
    };

    registerDecorator({
      name: 'isPublicFeeAmount',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [lowerBoundProperty],
      options,
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          isPublicFeeAmount(value) && !isBelowLowerBound(value, args),
        defaultMessage: (args: ValidationArguments) =>
          isBelowLowerBound(args.value, args)
            ? `${args.property} must be greater than or equal to ${lowerBoundProperty}`
            : `${args.property} must be an amount between ${PUBLIC_DISCOVERY_FEE.minimum} and ${PUBLIC_DISCOVERY_FEE.maximum} with at most ${PUBLIC_DISCOVERY_FEE.maxDecimalPlaces} decimal places`,
      },
    });
  };

/**
 * Applied to the end of a range. Passes when either bound is not a valid
 * date so the per-field date message is the only one reported for it.
 */
const IsBoundedPublicDateRange =
  (startProperty: string, options?: ValidationOptions): PropertyDecorator =>
  (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isBoundedPublicDateRange',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [startProperty],
      options,
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const start = parsePublicCalendarDate(
            (args.object as Record<string, unknown>)[startProperty],
          );
          const end = parsePublicCalendarDate(value);
          if (start === null || end === null) return true;
          return (
            end >= start &&
            end - start + 1 <= PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS
          );
        },
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be on or after ${startProperty} and cover at most ${PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS} days`,
      },
    });
  };

export class PublicPaginationQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: PUBLIC_DISCOVERY_PAGINATION.maxPage,
    default: PUBLIC_DISCOVERY_PAGINATION.defaultPage,
  })
  @IsOptional()
  @Type(() => Number)
  @IsBoundedInteger(1, PUBLIC_DISCOVERY_PAGINATION.maxPage)
  page: number = PUBLIC_DISCOVERY_PAGINATION.defaultPage;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: PUBLIC_DISCOVERY_PAGINATION.maxLimit,
    default: PUBLIC_DISCOVERY_PAGINATION.defaultLimit,
  })
  @IsOptional()
  @Type(() => Number)
  @IsBoundedInteger(1, PUBLIC_DISCOVERY_PAGINATION.maxLimit)
  limit: number = PUBLIC_DISCOVERY_PAGINATION.defaultLimit;
}

export class PublicSearchQueryDto extends PublicPaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive search term. Surrounding and repeated whitespace is ignored.',
    minLength: PUBLIC_DISCOVERY_SEARCH.minLength,
    maxLength: PUBLIC_DISCOVERY_SEARCH.maxLength,
  })
  @IsOptional()
  @Transform(({ value }) => normalizePublicSearchTerm(value))
  @IsPublicSearchTerm()
  q?: string;
}

export class PublicProfessionalDirectoryQueryDto extends PublicSearchQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Canonical identifier from the public speciality catalogue',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'speciality_id must be a UUID' })
  speciality_id?: string;

  @ApiPropertyOptional({
    enum: ConsultationType,
    enumName: 'ConsultationType',
    description:
      'chat or video also returns professionals who offer both; both returns only those who offer both',
  })
  @IsOptional()
  @IsEnum(ConsultationType, {
    message: `consultation_type must be one of: ${Object.values(ConsultationType).join(', ')}`,
  })
  consultation_type?: ConsultationType;

  @ApiPropertyOptional({
    type: 'number',
    minimum: PUBLIC_DISCOVERY_FEE.minimum,
    maximum: PUBLIC_DISCOVERY_FEE.maximum,
    multipleOf: 0.01,
    description: 'Lowest consultation fee to include',
  })
  @IsOptional()
  @Transform(({ value }) => parsePublicFeeAmount(value))
  @IsPublicFeeAmount()
  min_fee?: number;

  @ApiPropertyOptional({
    type: 'number',
    minimum: PUBLIC_DISCOVERY_FEE.minimum,
    maximum: PUBLIC_DISCOVERY_FEE.maximum,
    multipleOf: 0.01,
    description:
      'Highest consultation fee to include; not below min_fee when both are sent',
  })
  @IsOptional()
  @Transform(({ value }) => parsePublicFeeAmount(value))
  @IsPublicFeeAmount('min_fee')
  max_fee?: number;

  @ApiPropertyOptional({
    enum: PublicProfessionalSortField,
    enumName: 'PublicProfessionalSortField',
    default: PUBLIC_DISCOVERY_DEFAULT_SORT.field,
    description: `Defaults to ${PUBLIC_DISCOVERY_DEFAULT_SORT.field}`,
  })
  @IsOptional()
  @IsEnum(PublicProfessionalSortField, {
    message: `sort must be one of: ${Object.values(PublicProfessionalSortField).join(', ')}`,
  })
  sort: PublicProfessionalSortField = PUBLIC_DISCOVERY_DEFAULT_SORT.field;

  @ApiPropertyOptional({
    enum: PublicSortOrder,
    enumName: 'PublicSortOrder',
    default: PUBLIC_DISCOVERY_DEFAULT_SORT.order,
    description: `Defaults to ${PUBLIC_DISCOVERY_DEFAULT_SORT.order}. Ties are always broken by identifier, ascending`,
  })
  @IsOptional()
  @IsEnum(PublicSortOrder, {
    message: `order must be one of: ${Object.values(PublicSortOrder).join(', ')}`,
  })
  order: PublicSortOrder = PUBLIC_DISCOVERY_DEFAULT_SORT.order;
}

export class PublicDateRangeQueryDto {
  @ApiProperty({ format: 'date', example: '2026-01-15' })
  @IsPublicCalendarDate()
  from: string;

  @ApiProperty({
    format: 'date',
    example: '2026-01-21',
    description: `On or after from; the inclusive range covers at most ${PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS} days`,
  })
  @IsPublicCalendarDate()
  @IsBoundedPublicDateRange('from')
  to: string;
}
