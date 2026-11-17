import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import {
  isPublicCalendarDateOver,
  PublicDateRangeQueryDto,
  PublicProfessionalDirectoryQueryDto,
} from '../public-discovery/dto/public-discovery-query.dto';
import {
  PublicProfessionalAvailabilityDto,
  PublicProfessionalDetailDto,
  PublicProfessionalDirectoryDto,
} from '../public-discovery/dto/public-discovery-response.dto';
import { PublicDiscoveryVisibilityPolicy } from '../public-discovery/public-discovery-visibility.policy';
import { PublicDiscoveryClock } from '../public-discovery/public-discovery.clock';
import {
  PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS,
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../public-discovery/public-discovery.constants';
import {
  PublicQueryRejectedException,
  PublicResourceNotFoundException,
} from '../public-discovery/public-discovery.errors';
import {
  IPublicAvailabilitySlotSource,
  IPublicReviewAggregate,
  toPublicPaginationMeta,
  toPublicProfessionalAvailability,
  toPublicProfessionalDetail,
  toPublicProfessionalSummary,
} from '../public-discovery/public-discovery.mapper';
import { toPublicSearchPattern } from '../public-discovery/public-discovery.search';

import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import { ConsultationType, Professional } from './entities/professional.entity';

const ALIASES = {
  professional: 'professional',
  user: 'account',
  speciality: 'speciality',
} as const;

// Identifiers of the joined rows are needed to hydrate them and are never
// mapped into a response.
const PROFILE_COLUMNS = [
  'professional.id',
  'professional.image',
  'professional.consultation_fee',
  'professional.years_of_experience',
  'professional.consultation_type',
  'professional.is_available',
  'account.id',
  'account.first_name',
  'account.last_name',
  'speciality.id',
  'speciality.name',
] as const;

/** The directory reads the stored review summary it sorts by. */
const DIRECTORY_COLUMNS = [
  ...PROFILE_COLUMNS,
  'professional.rating',
  'professional.total_reviews',
] as const;

/** The detail reads the biography; its review aggregate comes from records. */
const DETAIL_COLUMNS = [...PROFILE_COLUMNS, 'professional.about'] as const;

/**
 * Sort allowlist. A requested sort value only ever selects one of these
 * fixed expressions; it is never placed in the query itself.
 */
const SORT_EXPRESSIONS: Record<PublicProfessionalSortField, readonly string[]> =
  {
    [PublicProfessionalSortField.RATING]: ['professional.rating'],
    [PublicProfessionalSortField.EXPERIENCE]: [
      'professional.years_of_experience',
    ],
    [PublicProfessionalSortField.CONSULTATION_FEE]: [
      'professional.consultation_fee',
    ],
    [PublicProfessionalSortField.NAME]: [
      'LOWER(account.first_name)',
      'LOWER(account.last_name)',
    ],
  };

/**
 * The instant a slot starts: its local date and time resolved in the zone
 * stored with the slot. The zone of the database session and of the server
 * take no part.
 */
const SLOT_STARTS_AT =
  '(availability.date + availability.start_time) AT TIME ZONE availability.time_zone';

/** An end time that is not after the start time is on the following day. */
const SLOT_ENDS_AT =
  "(availability.date + availability.end_time + CASE WHEN availability.end_time > availability.start_time THEN INTERVAL '0' ELSE INTERVAL '1 day' END) AT TIME ZONE availability.time_zone";

/** A booking recorded against the slot itself. */
const BOOKING_LINKED_TO_SLOT = 'occupying.availability_id = availability.id';

/**
 * A booking of the same professional, date, and time. Bookings made before
 * slots were linked carry no slot identifier and are found this way.
 */
const BOOKING_AT_SLOT_TIME =
  'occupying.professional_id = availability.professional_id AND occupying.booking_date = availability.date AND occupying.booking_time = availability.start_time';

export const PUBLIC_AVAILABILITY_RANGE_OVER_MESSAGE =
  'to must not be a date that has already passed';

/** Read-only projection of professional records for public discovery. */
@Injectable()
export class PublicProfessionalService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalReview)
    private readonly reviewRepository: Repository<ProfessionalReview>,
    @InjectRepository(ProfessionalAvailability)
    private readonly availabilityRepository: Repository<ProfessionalAvailability>,
    private readonly publicVisibility: PublicDiscoveryVisibilityPolicy,
    private readonly clock: PublicDiscoveryClock,
  ) {}

  /**
   * One page of the public directory: visible professionals only, narrowed by
   * the requested filters and ordered by the requested sort and then by
   * identifier. Runs one page query and one count query.
   */
  async findDirectory(
    query: PublicProfessionalDirectoryQueryDto,
  ): Promise<PublicProfessionalDirectoryDto> {
    const directory = this.createVisibleProfessionalQuery(DIRECTORY_COLUMNS);

    if (query.speciality_id) {
      directory.andWhere('professional.speciality_id = :publicSpecialityId', {
        publicSpecialityId: query.speciality_id,
      });
    }

    if (query.consultation_type) {
      // A professional who offers both modes satisfies either single mode.
      directory.andWhere(
        'professional.consultation_type IN (:...publicConsultationTypes)',
        {
          publicConsultationTypes: [
            ...new Set([query.consultation_type, ConsultationType.BOTH]),
          ],
        },
      );
    }

    if (query.min_fee !== undefined) {
      directory.andWhere('professional.consultation_fee >= :publicMinFee', {
        publicMinFee: query.min_fee,
      });
    }

    if (query.max_fee !== undefined) {
      directory.andWhere('professional.consultation_fee <= :publicMaxFee', {
        publicMaxFee: query.max_fee,
      });
    }

    if (query.q) {
      directory.andWhere(
        "(CONCAT_WS(' ', account.first_name, account.last_name) ILIKE :publicSearch ESCAPE '\\' OR speciality.name ILIKE :publicSearch ESCAPE '\\')",
        { publicSearch: toPublicSearchPattern(query.q) },
      );
    }

    const direction = query.order === PublicSortOrder.ASC ? 'ASC' : 'DESC';
    const [first, ...rest] = SORT_EXPRESSIONS[query.sort];
    directory.orderBy(first, direction);
    rest.forEach((expression) => directory.addOrderBy(expression, direction));
    directory.addOrderBy('professional.id', 'ASC');

    // The joins are to-one, so a plain limit and offset page whole rows.
    const [professionals, total] = await directory
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getManyAndCount();

    return {
      items: professionals.map(toPublicProfessionalSummary),
      meta: toPublicPaginationMeta(query.page, query.limit, total),
    };
  }

  /**
   * One visible professional, or the single public not-found outcome. A
   * professional who is missing and one who is not publicly visible run the
   * same statement and produce the same response.
   */
  async findOne(id: string): Promise<PublicProfessionalDetailDto> {
    const professional = await this.createVisibleProfessionalQuery(
      DETAIL_COLUMNS,
    )
      .andWhere('professional.id = :publicProfessionalId', {
        publicProfessionalId: id,
      })
      .getOne();
    if (!professional) throw new PublicResourceNotFoundException();

    return toPublicProfessionalDetail(
      professional,
      await this.readReviewAggregate(professional.id),
    );
  }

  /**
   * The slots of one visible professional that a consumer could still ask to
   * book: inside the requested dates, starting after this instant, still
   * offered, and not occupied by a booking. The result is information read at
   * one instant; it reserves nothing, and booking creation checks the slot
   * again.
   *
   * A professional who is missing and one who is not publicly visible run the
   * same single statement and produce the same response. A visible one costs
   * one more statement however many slots or bookings exist.
   */
  async findAvailability(
    id: string,
    query: PublicDateRangeQueryDto,
  ): Promise<PublicProfessionalAvailabilityDto> {
    const now = this.clock.now();

    // Decided before the professional is read, so the outcome of a range
    // never depends on which professional was asked about.
    if (isPublicCalendarDateOver(query.to, now)) {
      throw new PublicQueryRejectedException(
        PUBLIC_AVAILABILITY_RANGE_OVER_MESSAGE,
      );
    }

    const professional = await this.createVisibleProfessionalQuery([
      'professional.id',
    ])
      .andWhere('professional.id = :publicProfessionalId', {
        publicProfessionalId: id,
      })
      .getOne();
    if (!professional) throw new PublicResourceNotFoundException();

    // One row more than the bound shows whether later slots were left out.
    const slots = await this.createOpenSlotQuery(professional.id, query, now)
      .limit(PUBLIC_DISCOVERY_MAX_AVAILABILITY_SLOTS + 1)
      .getRawMany<IPublicAvailabilitySlotSource>();

    return toPublicProfessionalAvailability(query, now, slots);
  }

  /**
   * Slots of one professional that are open at `now`, earliest first. The
   * professional and date range bound the rows read through the slot index,
   * and occupancy is two anti-joins on indexed booking columns, so no query
   * runs per slot. Only published columns are selected; no booking column is.
   */
  private createOpenSlotQuery(
    professionalId: string,
    range: PublicDateRangeQueryDto,
    now: Date,
  ): SelectQueryBuilder<ProfessionalAvailability> {
    const slots = this.availabilityRepository
      .createQueryBuilder('availability')
      .select('availability.id', 'id')
      .addSelect("TO_CHAR(availability.date, 'YYYY-MM-DD')", 'date')
      .addSelect("TO_CHAR(availability.start_time, 'HH24:MI:SS')", 'start_time')
      .addSelect("TO_CHAR(availability.end_time, 'HH24:MI:SS')", 'end_time')
      .addSelect('availability.time_zone', 'time_zone')
      .addSelect(SLOT_STARTS_AT, 'starts_at')
      .addSelect(SLOT_ENDS_AT, 'ends_at')
      .where('availability.professional_id = :publicProfessionalId', {
        publicProfessionalId: professionalId,
      })
      .andWhere('availability.date BETWEEN :publicFrom AND :publicTo', {
        publicFrom: range.from,
        publicTo: range.to,
      })
      .andWhere('availability.is_available = :publicSlotOffered', {
        publicSlotOffered: true,
      })
      // A slot that ends when it starts offers no time.
      .andWhere('availability.end_time <> availability.start_time')
      .andWhere(`${SLOT_STARTS_AT} > :publicNow`, { publicNow: now });

    [BOOKING_LINKED_TO_SLOT, BOOKING_AT_SLOT_TIME].forEach((occupies) =>
      slots.andWhere(
        `NOT EXISTS ${slots
          .subQuery()
          .select('1')
          .from(Booking, 'occupying')
          .where(occupies)
          .andWhere('occupying.status <> :publicCancelledBooking')
          .getQuery()}`,
      ),
    );

    return slots
      .setParameter('publicCancelledBooking', BookingStatus.CANCELLED)
      .orderBy(SLOT_STARTS_AT, 'ASC')
      .addOrderBy('availability.id', 'ASC');
  }

  /**
   * Average rating and count taken from the review records themselves, so a
   * stale stored summary is never published. Only the aggregate leaves this
   * method; reviewers, comments, and bookings are not read.
   */
  private async readReviewAggregate(
    professionalId: string,
  ): Promise<IPublicReviewAggregate> {
    const aggregate = await this.reviewRepository
      .createQueryBuilder('review')
      .select('ROUND(AVG(review.rating), 2)', 'rating')
      .addSelect('COUNT(*)', 'total_reviews')
      .where('review.professional_id = :publicProfessionalId', {
        publicProfessionalId: professionalId,
      })
      .getRawOne<{ rating: string | null; total_reviews: string }>();

    return {
      rating: Number(aggregate?.rating ?? 0),
      total_reviews: Number(aggregate?.total_reviews ?? 0),
    };
  }

  private createVisibleProfessionalQuery(
    columns: readonly string[],
  ): SelectQueryBuilder<Professional> {
    return this.publicVisibility.applyProfessionalVisibility(
      this.professionalRepository
        .createQueryBuilder(ALIASES.professional)
        .innerJoin('professional.user', ALIASES.user)
        .innerJoin('professional.speciality', ALIASES.speciality)
        .select([...columns]),
      ALIASES,
    );
  }
}
