import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { PublicProfessionalDirectoryQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import { PublicProfessionalDirectoryDto } from '../public-discovery/dto/public-discovery-response.dto';
import { PublicDiscoveryVisibilityPolicy } from '../public-discovery/public-discovery-visibility.policy';
import {
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../public-discovery/public-discovery.constants';
import {
  toPublicPaginationMeta,
  toPublicProfessionalSummary,
} from '../public-discovery/public-discovery.mapper';
import { toPublicSearchPattern } from '../public-discovery/public-discovery.search';

import { ConsultationType, Professional } from './entities/professional.entity';

const ALIASES = {
  professional: 'professional',
  user: 'account',
  speciality: 'speciality',
} as const;

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

/** Read-only projection of professional records for public discovery. */
@Injectable()
export class PublicProfessionalService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    private readonly publicVisibility: PublicDiscoveryVisibilityPolicy,
  ) {}

  /**
   * One page of the public directory: visible professionals only, narrowed by
   * the requested filters and ordered by the requested sort and then by
   * identifier. Runs one page query and one count query.
   */
  async findDirectory(
    query: PublicProfessionalDirectoryQueryDto,
  ): Promise<PublicProfessionalDirectoryDto> {
    const directory = this.createVisibleProfessionalQuery();

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

  private createVisibleProfessionalQuery(): SelectQueryBuilder<Professional> {
    return this.publicVisibility.applyProfessionalVisibility(
      this.professionalRepository
        .createQueryBuilder(ALIASES.professional)
        .innerJoin('professional.user', ALIASES.user)
        .innerJoin('professional.speciality', ALIASES.speciality)
        .select([
          'professional.id',
          'professional.image',
          'professional.rating',
          'professional.total_reviews',
          'professional.consultation_fee',
          'professional.years_of_experience',
          'professional.consultation_type',
          'professional.is_available',
          // Identifiers of the joined rows are needed to hydrate them and are
          // never mapped into a response.
          'account.id',
          'account.first_name',
          'account.last_name',
          'speciality.id',
          'speciality.name',
        ]),
      ALIASES,
    );
  }
}
