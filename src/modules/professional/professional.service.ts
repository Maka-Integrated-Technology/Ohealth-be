import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';

import {
  ProfessionalResponseDto,
  ProfessionalDetailResponseDto,
} from './dto/professional-response.dto';
import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { Professional } from './entities/professional.entity';

@Injectable()
export class ProfessionalService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalAvailability)
    private readonly availabilityRepository: Repository<ProfessionalAvailability>,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: ProfessionalService.name });
  }

  async findBySpeciality(
    specialityId: string,
  ): Promise<ProfessionalResponseDto[]> {
    const professionals = await this.professionalRepository.find({
      where: {
        speciality_id: specialityId,
        is_active: true,
      },
      relations: ['user', 'speciality'],
      order: { rating: 'DESC' },
    });

    return professionals.map((prof) => ({
      id: prof.id,
      name: `${prof.user.first_name} ${prof.user.last_name}`,
      image: prof.image,
      speciality: prof.speciality.name,
      rating: Number(prof.rating),
      total_reviews: prof.total_reviews,
      consultation_fee: Number(prof.consultation_fee),
      years_of_experience: prof.years_of_experience,
      about: prof.about,
      consultation_type: prof.consultation_type,
      is_available: prof.is_available,
    }));
  }

  async findOne(id: string): Promise<ProfessionalDetailResponseDto> {
    const professional = await this.professionalRepository.findOne({
      where: { id, is_active: true },
      relations: ['user', 'speciality', 'availabilities'],
    });

    if (!professional) {
      this.logger.warn(`Professional not found: ${id}`);
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);
    }

    const availabilities = await this.availabilityRepository.find({
      where: {
        professional_id: id,
        is_available: true,
      },
      order: { date: 'ASC', start_time: 'ASC' },
    });

    const groupedAvailabilities = availabilities.reduce(
      (acc, avail) => {
        const existing = acc.find((item) => item.date === avail.date);
        const slot = {
          start_time: avail.start_time,
          end_time: avail.end_time,
          is_available: avail.is_available,
        };

        if (existing) {
          existing.slots.push(slot);
        } else {
          acc.push({ date: avail.date, slots: [slot] });
        }

        return acc;
      },
      [] as {
        date: string;
        slots: {
          start_time: string;
          end_time: string;
          is_available: boolean;
        }[];
      }[],
    );

    return {
      id: professional.id,
      name: `${professional.user.first_name} ${professional.user.last_name}`,
      image: professional.image,
      speciality: professional.speciality.name,
      rating: Number(professional.rating),
      total_reviews: professional.total_reviews,
      consultation_fee: Number(professional.consultation_fee),
      years_of_experience: professional.years_of_experience,
      about: professional.about,
      consultation_type: professional.consultation_type,
      is_available: professional.is_available,
      availabilities: groupedAvailabilities,
    };
  }
}
