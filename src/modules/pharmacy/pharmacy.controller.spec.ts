import { Test, TestingModule } from '@nestjs/testing';

import { PharmacyVerificationStatus } from './entities/pharmacy.entity';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';

describe('PharmacyController', () => {
  let controller: PharmacyController;
  let pharmacyService: PharmacyService;

  const mockPharmacyService = {
    register: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmacyController],
      providers: [
        {
          provide: PharmacyService,
          useValue: mockPharmacyService,
        },
      ],
    }).compile();

    controller = module.get<PharmacyController>(PharmacyController);
    pharmacyService = module.get<PharmacyService>(PharmacyService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should register a pharmacy through the pharmacy service', async () => {
    const payload = {
      name: 'HealthPlus Pharmacy',
      registration_number: 'PCN-123456',
      license_number: 'LIC-789012',
      business_address: '12 Admiralty Way, Lekki',
      region: 'Lagos',
      contact_email: 'contact@healthplus.example',
      contact_phone: '+2348012345678',
    };
    const expected = {
      id: 'pharmacy-id-1',
      ...payload,
      verification_status: PharmacyVerificationStatus.SUBMITTED,
      is_active: true,
      created_at: new Date('2026-07-11T12:00:00.000Z'),
      updated_at: new Date('2026-07-11T12:00:00.000Z'),
    };
    mockPharmacyService.register.mockResolvedValue(expected);

    const result = await controller.register(payload);

    expect(pharmacyService.register).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });
});
