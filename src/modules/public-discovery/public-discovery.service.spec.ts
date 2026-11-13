import { PublicDiscoveryService } from './public-discovery.service';

describe('PublicDiscoveryService', () => {
  it('publishes the enforced query limits and allowlists', () => {
    expect(new PublicDiscoveryService().getContract()).toEqual({
      pagination: { default_limit: 20, max_limit: 50, max_page: 1000 },
      search: { min_length: 2, max_length: 100 },
      professional_sort: {
        fields: ['rating', 'experience', 'consultation_fee', 'name'],
        orders: ['asc', 'desc'],
        default_field: 'rating',
        default_order: 'desc',
      },
      consultation_types: ['chat', 'video', 'both'],
      max_availability_range_days: 31,
    });
  });
});
