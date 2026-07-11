import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';

import { CreatePharmacyDto } from './dto/create-pharmacy.dto';
import { PharmacyResponseDto } from './dto/pharmacy-response.dto';
import {
  Pharmacy,
  PharmacyVerificationStatus,
} from './entities/pharmacy.entity';

@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(Pharmacy)
    private readonly pharmacyRepository: Repository<Pharmacy>,
  ) {}

  async register(dto: CreatePharmacyDto): Promise<PharmacyResponseDto> {
    const name = this.normalizeRequiredString(dto.name, 'name');
    const registrationNumber = this.normalizeRequiredString(
      dto.registration_number,
      'registration_number',
    );
    const licenseNumber = this.normalizeRequiredString(
      dto.license_number,
      'license_number',
    );
    const businessAddress = this.normalizeRequiredString(
      dto.business_address,
      'business_address',
    );
    const region = this.normalizeRequiredString(dto.region, 'region');
    const contactEmail = this.normalizeRequiredString(
      dto.contact_email,
      'contact_email',
    ).toLowerCase();
    const contactPhone = this.normalizeRequiredString(
      dto.contact_phone,
      'contact_phone',
    );

    const duplicate = await this.pharmacyRepository.findOne({
      where: [
        { registration_number: registrationNumber },
        { license_number: licenseNumber },
      ],
    });
    if (duplicate) {
      throw new ConflictException(sysMsg.PHARMACY_ALREADY_EXISTS);
    }

    const pharmacy = this.pharmacyRepository.create({
      name,
      registration_number: registrationNumber,
      license_number: licenseNumber,
      business_address: businessAddress,
      region,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      verification_status: PharmacyVerificationStatus.SUBMITTED,
      is_active: true,
    });

    let saved: Pharmacy;
    try {
      saved = await this.pharmacyRepository.save(pharmacy);
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException(sysMsg.PHARMACY_ALREADY_EXISTS);
      }
      throw error;
    }

    return this.toDto(saved);
  }

  private normalizeRequiredString(value: string, fieldName: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return normalized;
  }

  private toDto(pharmacy: Pharmacy): PharmacyResponseDto {
    return {
      id: pharmacy.id,
      name: pharmacy.name,
      registration_number: pharmacy.registration_number,
      license_number: pharmacy.license_number,
      business_address: pharmacy.business_address,
      region: pharmacy.region,
      contact_email: pharmacy.contact_email,
      contact_phone: pharmacy.contact_phone,
      verification_status: pharmacy.verification_status,
      is_active: pharmacy.is_active,
      created_at: pharmacy.created_at,
      updated_at: pharmacy.updated_at,
    };
  }
}
