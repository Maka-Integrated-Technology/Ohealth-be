import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import * as sysMsg from '../../constants/system.messages';

import {
  Pharmacy,
  PharmacyVerificationStatus,
} from './entities/pharmacy.entity';
import { PharmacyService } from './pharmacy.service';

describe('PharmacyService', () => {
  let service: PharmacyService;

  const mockPharmacyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        {
          provide: getRepositoryToken(Pharmacy),
          useValue: mockPharmacyRepository,
        },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create a pharmacy registration with submitted status', async () => {
      const createdAt = new Date('2026-07-11T12:00:00.000Z');
      const updatedAt = new Date('2026-07-11T12:00:00.000Z');

      mockPharmacyRepository.findOne.mockResolvedValue(null);
      mockPharmacyRepository.create.mockImplementation(
        (payload: Partial<Pharmacy>) => payload,
      );
      mockPharmacyRepository.save.mockImplementation(
        async (payload: Partial<Pharmacy>) => ({
          id: 'pharmacy-id-1',
          created_at: createdAt,
          updated_at: updatedAt,
          ...payload,
        }),
      );

      const result = await service.register({
        name: ' HealthPlus Pharmacy ',
        registration_number: ' PCN-123456 ',
        license_number: ' LIC-789012 ',
        business_address: ' 12 Admiralty Way, Lekki ',
        region: ' Lagos ',
        contact_email: ' CONTACT@HEALTHPLUS.EXAMPLE ',
        contact_phone: ' +2348012345678 ',
      });

      expect(mockPharmacyRepository.findOne).toHaveBeenCalledWith({
        where: [
          { registration_number: 'PCN-123456' },
          { license_number: 'LIC-789012' },
        ],
      });
      expect(mockPharmacyRepository.create).toHaveBeenCalledWith({
        name: 'HealthPlus Pharmacy',
        registration_number: 'PCN-123456',
        license_number: 'LIC-789012',
        business_address: '12 Admiralty Way, Lekki',
        region: 'Lagos',
        contact_email: 'contact@healthplus.example',
        contact_phone: '+2348012345678',
        verification_status: PharmacyVerificationStatus.SUBMITTED,
        is_active: true,
      });
      expect(result).toEqual({
        id: 'pharmacy-id-1',
        name: 'HealthPlus Pharmacy',
        registration_number: 'PCN-123456',
        license_number: 'LIC-789012',
        business_address: '12 Admiralty Way, Lekki',
        region: 'Lagos',
        contact_email: 'contact@healthplus.example',
        contact_phone: '+2348012345678',
        verification_status: PharmacyVerificationStatus.SUBMITTED,
        is_active: true,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    });

    it('should reject duplicate pharmacy registration details', async () => {
      mockPharmacyRepository.findOne.mockResolvedValue({
        id: 'existing-pharmacy-id',
      });

      await expect(
        service.register({
          name: 'Existing Pharmacy',
          registration_number: 'PCN-123456',
          license_number: 'LIC-789012',
          business_address: '12 Admiralty Way, Lekki',
          region: 'Lagos',
          contact_email: 'contact@healthplus.example',
          contact_phone: '+2348012345678',
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.register({
          name: 'Existing Pharmacy',
          registration_number: 'PCN-123456',
          license_number: 'LIC-789012',
          business_address: '12 Admiralty Way, Lekki',
          region: 'Lagos',
          contact_email: 'contact@healthplus.example',
          contact_phone: '+2348012345678',
        }),
      ).rejects.toThrow(sysMsg.PHARMACY_ALREADY_EXISTS);
    });

    it('should reject direct service calls with whitespace-only required fields', async () => {
      await expect(
        service.register({
          name: '   ',
          registration_number: 'PCN-123456',
          license_number: 'LIC-789012',
          business_address: '12 Admiralty Way, Lekki',
          region: 'Lagos',
          contact_email: 'contact@healthplus.example',
          contact_phone: '+2348012345678',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPharmacyRepository.findOne).not.toHaveBeenCalled();
      expect(mockPharmacyRepository.save).not.toHaveBeenCalled();
    });

    it('should map database unique constraint failures to conflict exceptions', async () => {
      mockPharmacyRepository.findOne.mockResolvedValue(null);
      mockPharmacyRepository.create.mockImplementation(
        (payload: Partial<Pharmacy>) => payload,
      );
      mockPharmacyRepository.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.register({
          name: 'HealthPlus Pharmacy',
          registration_number: 'PCN-123456',
          license_number: 'LIC-789012',
          business_address: '12 Admiralty Way, Lekki',
          region: 'Lagos',
          contact_email: 'contact@healthplus.example',
          contact_phone: '+2348012345678',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected persistence errors', async () => {
      const error = new Error('database unavailable');

      mockPharmacyRepository.findOne.mockResolvedValue(null);
      mockPharmacyRepository.create.mockImplementation(
        (payload: Partial<Pharmacy>) => payload,
      );
      mockPharmacyRepository.save.mockRejectedValue(error);

      await expect(
        service.register({
          name: 'HealthPlus Pharmacy',
          registration_number: 'PCN-123456',
          license_number: 'LIC-789012',
          business_address: '12 Admiralty Way, Lekki',
          region: 'Lagos',
          contact_email: 'contact@healthplus.example',
          contact_phone: '+2348012345678',
        }),
      ).rejects.toThrow(error);
    });
  });
});
