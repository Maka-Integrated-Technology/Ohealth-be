import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';

import { CreatePharmacyDto } from './dto/create-pharmacy.dto';
import { PharmacyResponseDto } from './dto/pharmacy-response.dto';
import { Pharmacy, PharmacyVerificationStatus } from './entities/pharmacy.entity';

@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(Pharmacy)
    private readonly pharmacyRepository: Repository<Pharmacy>,
  ) {}

  async register(dto: CreatePharmacyDto): Promise<PharmacyResponseDto> {
    const registrationNumber = dto.registration_number.trim();
    const licenseNumber = dto.license_number.trim();

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
      name: dto.name.trim(),
      registration_number: registrationNumber,
      license_number: licenseNumber,
      business_address: dto.business_address.trim(),
      region: dto.region.trim(),
      contact_email: dto.contact_email.trim().toLowerCase(),
      contact_phone: dto.contact_phone.trim(),
      verification_status: PharmacyVerificationStatus.SUBMITTED,
      is_active: true,
    });

    const saved = await this.pharmacyRepository.save(pharmacy);
    return this.toDto(saved);
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
