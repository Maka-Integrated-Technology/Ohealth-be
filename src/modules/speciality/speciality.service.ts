import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Speciality } from './entities/speciality.entity';
import { SpecialityResponseDto } from './dto/speciality-response.dto';

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

    return specialities.map((speciality) => ({
      id: speciality.id,
      name: speciality.name,
      description: speciality.description,
      icon: speciality.icon,
      is_active: speciality.is_active,
    }));
  }

  async findOne(id: string): Promise<Speciality> {
    return this.specialityRepository.findOne({
      where: { id, is_active: true },
    });
  }
}
