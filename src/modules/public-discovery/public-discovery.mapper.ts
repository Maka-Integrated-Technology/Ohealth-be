import { Professional } from '../professional/entities/professional.entity';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';

import { PublicDateRangeQueryDto } from './dto/public-discovery-query.dto';
import {
  PublicAvailabilityDayDto,
  PublicPaginationMetaDto,
  PublicProfessionalAvailabilityDto,
  PublicProfessionalDetailDto,
  PublicProfessionalSummaryDto,
  PublicSpecialityDto,
} from './dto/public-discovery-response.dto';
import {
  PUBLIC_DISCOVERY_ICON,
  PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS,
} from './public-discovery.constants';
import { toPublicLabel, toPublicProse } from './public-discovery.text';

export type PublicSpecialitySource = Pick<
  Speciality,
  'id' | 'name' | 'description' | 'icon'
>;

type PublicProfessionalProfileSource = Pick<
  Professional,
  | 'id'
  | 'image'
  | 'consultation_fee'
  | 'years_of_experience'
  | 'consultation_type'
  | 'is_available'
> & {
  user: Pick<User, 'first_name' | 'last_name'>;
  speciality: Pick<Speciality, 'id' | 'name'>;
};

/** A directory row, carrying the stored review summary it is sorted by. */
export type PublicProfessionalSource = PublicProfessionalProfileSource &
  Pick<Professional, 'rating' | 'total_reviews'>;

/** A detail row. Its review aggregate is supplied from the review records. */
export type PublicProfessionalDetailSource = PublicProfessionalProfileSource &
  Pick<Professional, 'about'>;

/** Aggregate of a professional's review records; no single review is in it. */
export interface IPublicReviewAggregate {
  rating: number;
  total_reviews: number;
}

/**
 * A slot as the availability query reads it: its local date and times as
 * text, the zone they are local to, and the instants that zone resolves them
 * to. Whose slot it is and whether it is flagged available are not part of it.
 */
export interface IPublicAvailabilitySlotSource {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  starts_at: Date;
  ends_at: Date;
}

/**
 * Only absolute HTTPS addresses are published. Storage keys, relative paths,
 * and any other stored value are withheld rather than passed through.
 */
export function toPublicImageUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    const hasCredentials = url.username !== '' || url.password !== '';
    return url.protocol === 'https:' && !hasCredentials ? url.toString() : null;
  } catch {
    return null;
  }
}

const PUBLIC_ICON_IDENTIFIER = new RegExp(PUBLIC_DISCOVERY_ICON.pattern);

/**
 * Only a bounded lower-case asset identifier such as `general-doctor` is
 * published. File names, paths, addresses, storage keys, and any other stored
 * value are withheld rather than passed through.
 */
export function toPublicIconIdentifier(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > PUBLIC_DISCOVERY_ICON.maxLength) return null;
  return PUBLIC_ICON_IDENTIFIER.test(value) ? value : null;
}

function toPublicDisplayName(
  user: Pick<User, 'first_name' | 'last_name'>,
): string {
  return toPublicLabel(
    [user.first_name, user.last_name]
      .filter((part) => typeof part === 'string')
      .join(' '),
  );
}

export function toPublicSpeciality(
  speciality: PublicSpecialitySource,
): PublicSpecialityDto {
  return {
    id: speciality.id,
    name: toPublicLabel(speciality.name),
    description: toPublicProse(speciality.description),
    icon: toPublicIconIdentifier(speciality.icon),
  };
}

function toPublicProfessionalProfile(
  professional: PublicProfessionalProfileSource,
  reviews: IPublicReviewAggregate,
): PublicProfessionalSummaryDto {
  return {
    id: professional.id,
    name: toPublicDisplayName(professional.user),
    image: toPublicImageUrl(professional.image),
    speciality: {
      id: professional.speciality.id,
      name: toPublicLabel(professional.speciality.name),
    },
    rating: reviews.rating,
    total_reviews: reviews.total_reviews,
    consultation_fee: Number(professional.consultation_fee),
    years_of_experience: professional.years_of_experience,
    consultation_type: professional.consultation_type,
    is_available: professional.is_available,
  };
}

export function toPublicProfessionalSummary(
  professional: PublicProfessionalSource,
): PublicProfessionalSummaryDto {
  return toPublicProfessionalProfile(professional, {
    rating: Number(professional.rating),
    total_reviews: professional.total_reviews,
  });
}

export function toPublicProfessionalDetail(
  professional: PublicProfessionalDetailSource,
  reviews: IPublicReviewAggregate,
): PublicProfessionalDetailDto {
  return {
    ...toPublicProfessionalProfile(professional, reviews),
    about: toPublicProse(professional.about),
  };
}

/** Earliest start first; the identifier makes the order total. */
function orderPublicAvailabilitySlots(
  slots: readonly IPublicAvailabilitySlotSource[],
): IPublicAvailabilitySlotSource[] {
  return [...slots].sort(
    (a, b) =>
      a.starts_at.getTime() - b.starts_at.getTime() || a.id.localeCompare(b.id),
  );
}

/**
 * Groups slots under the local date they start on. Slots are ordered by the
 * instant they start, so the result does not depend on the order of the rows.
 */
export function toPublicAvailabilityDays(
  slots: readonly IPublicAvailabilitySlotSource[],
): PublicAvailabilityDayDto[] {
  const days = new Map<string, PublicAvailabilityDayDto>();

  for (const slot of orderPublicAvailabilitySlots(slots)) {
    const day = days.get(slot.date) ?? { date: slot.date, slots: [] };
    day.slots.push({
      id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      time_zone: slot.time_zone,
      starts_at: slot.starts_at.toISOString(),
      ends_at: slot.ends_at.toISOString(),
    });
    days.set(slot.date, day);
  }

  return [...days.values()];
}

/**
 * The availability of one professional over a range, read at `asOf`. At most
 * `maxSlots` of the earliest slots are published; `has_more` reports that
 * later ones were left out.
 */
export function toPublicProfessionalAvailability(
  range: Pick<PublicDateRangeQueryDto, 'from' | 'to'>,
  asOf: Date,
  slots: readonly IPublicAvailabilitySlotSource[],
  maxSlots: number = PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS,
): PublicProfessionalAvailabilityDto {
  return {
    from: range.from,
    to: range.to,
    as_of: asOf.toISOString(),
    days: toPublicAvailabilityDays(
      orderPublicAvailabilitySlots(slots).slice(0, maxSlots),
    ),
    has_more: slots.length > maxSlots,
  };
}

export function toPublicPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PublicPaginationMetaDto {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    has_next: page * limit < total,
    has_previous: page > 1,
  };
}
