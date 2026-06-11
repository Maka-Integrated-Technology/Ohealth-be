import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';

import { CreateSpecialityDto } from './dto/create-speciality.dto';
import { SpecialityResponseDto } from './dto/speciality-response.dto';
import { UpdateSpecialityDto } from './dto/update-speciality.dto';
import { Speciality } from './entities/speciality.entity';

@Injectable()
export class SpecialityService {
  constructor(
    @InjectRepository(Speciality)
    private readonly specialityRepository: Repository<Speciality>,
  ) {}

  async findAll(): Promise<SpecialityResponseDto[]> {
    const specialities = await this.specialityRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
    return specialities.map(this.toDto);
  }

  async findById(id: string): Promise<SpecialityResponseDto> {
    const speciality = await this.specialityRepository.findOne({
      where: { id },
    });
    if (!speciality) throw new NotFoundException(sysMsg.SPECIALITY_NOT_FOUND);
    return this.toDto(speciality);
  }

  async create(dto: CreateSpecialityDto): Promise<SpecialityResponseDto> {
    const exists = await this.specialityRepository.findOne({
      where: { name: dto.name },
    });
    if (exists) throw new ConflictException(sysMsg.SPECIALITY_ALREADY_EXISTS);

    const speciality = this.specialityRepository.create(dto);
    const saved = await this.specialityRepository.save(speciality);
    return this.toDto(saved);
  }

  async update(
    id: string,
    dto: UpdateSpecialityDto,
  ): Promise<SpecialityResponseDto> {
    const speciality = await this.specialityRepository.findOne({
      where: { id },
    });
    if (!speciality) throw new NotFoundException(sysMsg.SPECIALITY_NOT_FOUND);

    // Unique name check when name is being changed
    if (dto.name && dto.name !== speciality.name) {
      const nameConflict = await this.specialityRepository.findOne({
        where: { name: dto.name },
      });
      if (nameConflict)
        throw new ConflictException(sysMsg.SPECIALITY_ALREADY_EXISTS);
    }

    Object.assign(speciality, dto);
    const saved = await this.specialityRepository.save(speciality);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<Speciality> {
    const speciality = await this.specialityRepository.findOne({
      where: { id, is_active: true },
    });
    if (!speciality) throw new NotFoundException(sysMsg.SPECIALITY_NOT_FOUND);
    return speciality;
  }

  private toDto(speciality: Speciality): SpecialityResponseDto {
    return {
      id: speciality.id,
      name: speciality.name,
      description: speciality.description,
      icon: speciality.icon,
      is_active: speciality.is_active,
      created_at: speciality.created_at,
      updated_at: speciality.updated_at,
    };
  }
}
