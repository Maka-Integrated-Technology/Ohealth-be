import { Injectable } from '@nestjs/common';

import { ConsultationType } from '../professional/entities/professional.entity';

import { PublicDiscoveryContractDto } from './dto/public-discovery-response.dto';
import {
  PUBLIC_DISCOVERY_DEFAULT_SORT,
  PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS,
  PUBLIC_DISCOVERY_PAGINATION,
  PUBLIC_DISCOVERY_SEARCH,
  PublicProfessionalSortField,
  PublicSortOrder,
} from './public-discovery.constants';

@Injectable()
export class PublicDiscoveryService {
  /** The query limits and allowlists enforced by every discovery endpoint. */
  getContract(): PublicDiscoveryContractDto {
    return {
      pagination: {
        default_limit: PUBLIC_DISCOVERY_PAGINATION.defaultLimit,
        max_limit: PUBLIC_DISCOVERY_PAGINATION.maxLimit,
        max_page: PUBLIC_DISCOVERY_PAGINATION.maxPage,
      },
      search: {
        min_length: PUBLIC_DISCOVERY_SEARCH.minLength,
        max_length: PUBLIC_DISCOVERY_SEARCH.maxLength,
      },
      professional_sort: {
        fields: Object.values(PublicProfessionalSortField),
        orders: Object.values(PublicSortOrder),
        default_field: PUBLIC_DISCOVERY_DEFAULT_SORT.field,
        default_order: PUBLIC_DISCOVERY_DEFAULT_SORT.order,
      },
      consultation_types: Object.values(ConsultationType),
      max_availability_range_days: PUBLIC_DISCOVERY_MAX_DATE_RANGE_DAYS,
    };
  }
}
