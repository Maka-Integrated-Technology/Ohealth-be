import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import { Professional } from '../professional/entities/professional.entity';
import { Speciality } from '../speciality/entities/speciality.entity';
import { User } from '../user/entities/user.entity';

import {
  PublicAvailabilityDayDto,
  PublicPaginationMetaDto,
  PublicProfessionalDetailDto,
  PublicProfessionalSummaryDto,
  PublicSpecialityDto,
} from './dto/public-discovery-response.dto';

export type PublicSpecialitySource = Pick<
  Speciality,
  'id' | 'name' | 'description' | 'icon'
>;

export type PublicProfessionalSource = Pick<
  Professional,
  | 'id'
  | 'image'
  | 'about'
  | 'rating'
  | 'total_reviews'
  | 'consultation_fee'
  | 'years_of_experience'
  | 'consultation_type'
  | 'is_available'
> & {
  user: Pick<User, 'first_name' | 'last_name'>;
  speciality: Pick<Speciality, 'id' | 'name'>;
};

export type PublicAvailabilitySource = Pick<
  ProfessionalAvailability,
  'id' | 'date' | 'start_time' | 'end_time'
>;

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

function toPublicDisplayName(
  user: Pick<User, 'first_name' | 'last_name'>,
): string {
  return [user.first_name, user.last_name]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

export function toPublicSpeciality(
  speciality: PublicSpecialitySource,
): PublicSpecialityDto {
  return {
    id: speciality.id,
    name: speciality.name,
    description: speciality.description ?? null,
    icon: speciality.icon ?? null,
  };
}

export function toPublicProfessionalSummary(
  professional: PublicProfessionalSource,
): PublicProfessionalSummaryDto {
  return {
    id: professional.id,
    name: toPublicDisplayName(professional.user),
    image: toPublicImageUrl(professional.image),
    speciality: {
      id: professional.speciality.id,
      name: professional.speciality.name,
    },
    rating: Number(professional.rating),
    total_reviews: professional.total_reviews,
    consultation_fee: Number(professional.consultation_fee),
    years_of_experience: professional.years_of_experience,
    consultation_type: professional.consultation_type,
    is_available: professional.is_available,
  };
}

export function toPublicProfessionalDetail(
  professional: PublicProfessionalSource,
): PublicProfessionalDetailDto {
  return {
    ...toPublicProfessionalSummary(professional),
    about: professional.about ?? null,
  };
}

/** Groups slots by day, ordered by date and then start time. */
export function toPublicAvailabilityDays(
  slots: readonly PublicAvailabilitySource[],
): PublicAvailabilityDayDto[] {
  const days = new Map<string, PublicAvailabilityDayDto>();
  const ordered = [...slots].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time),
  );

  for (const slot of ordered) {
    const day = days.get(slot.date) ?? { date: slot.date, slots: [] };
    day.slots.push({
      id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
    });
    days.set(slot.date, day);
  }

  return [...days.values()];
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
