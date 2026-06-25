import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { Booking } from '../booking/entities/booking.entity';
import { SpecialityService } from '../speciality/speciality.service';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { BulkCreateAvailabilityDto } from './dto/create-professional-availability.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ProfessionalDetailResponseDto,
  ProfessionalResponseDto,
} from './dto/professional-response.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import { Professional } from './entities/professional.entity';

/** Non-patient, non-admin roles that may have a professional profile. */
const PROFESSIONAL_ROLES: UserRole[] = [
  UserRole.DOCTOR,
  UserRole.THERAPIST,
  UserRole.COUNSELLOR,
  UserRole.LAB_PROFESSIONAL,
];

@Injectable()
export class ProfessionalService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalAvailability)
    private readonly availabilityRepository: Repository<ProfessionalAvailability>,
    @InjectRepository(ProfessionalReview)
    private readonly reviewRepository: Repository<ProfessionalReview>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly specialityService: SpecialityService,
    private readonly dataSource: DataSource,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: ProfessionalService.name });
  }

  async findBySpeciality(
    specialityId: string,
  ): Promise<ProfessionalResponseDto[]> {
    const professionals = await this.professionalRepository.find({
      where: { speciality_id: specialityId, is_active: true },
      relations: ['user', 'speciality'],
      order: { rating: 'DESC' },
    });

    return professionals.map(this.toProfessionalDto);
  }

  async findOne(id: string): Promise<ProfessionalDetailResponseDto> {
    const professional = await this.professionalRepository.findOne({
      where: { id, is_active: true },
      relations: ['user', 'speciality'],
    });

    if (!professional) {
      this.logger.warn(`Professional not found: ${id}`);
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);
    }

    const availabilities = await this.availabilityRepository.find({
      where: { professional_id: id, is_available: true },
      order: { date: 'ASC', start_time: 'ASC' },
    });

    const groupedAvailabilities = availabilities.reduce(
      (acc, avail) => {
        const existing = acc.find((item) => item.date === avail.date);
        const slot = {
          id: avail.id,
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
          id: string;
          start_time: string;
          end_time: string;
          is_available: boolean;
        }[];
      }[],
    );

    return {
      ...this.toProfessionalDto(professional),
      availabilities: groupedAvailabilities,
    };
  }

  async createProfessional(
    dto: CreateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    // 1. User must exist
    const user = await this.userRepository.findOne({
      where: { id: dto.user_id },
    });
    if (!user) throw new NotFoundException(sysMsg.USER_NOT_FOUND);

    // 2. User must hold a valid professional role
    const hasProfessionalRole = (user.role ?? []).some((r) =>
      PROFESSIONAL_ROLES.includes(r as UserRole),
    );
    if (!hasProfessionalRole) {
      throw new BadRequestException(sysMsg.PROFESSIONAL_INVALID_ROLE);
    }

    // 3. Speciality must exist and be active
    await this.specialityService.findOne(dto.speciality_id); // throws if not found / inactive

    // 4. Duplicate profile guard
    const duplicate = await this.professionalRepository.findOne({
      where: { user_id: dto.user_id },
    });
    if (duplicate)
      throw new ConflictException(sysMsg.PROFESSIONAL_ALREADY_EXISTS);

    const professional = this.professionalRepository.create({
      user_id: dto.user_id,
      speciality_id: dto.speciality_id,
      image: dto.image,
      about: dto.about,
      years_of_experience: dto.years_of_experience ?? 0,
      consultation_fee: dto.consultation_fee,
      consultation_type: dto.consultation_type,
    });

    const saved = await this.professionalRepository.save(professional);
    this.logger.info(
      `Professional created: ${saved.id} for user ${dto.user_id}`,
    );

    // Reload with relations for a consistent response DTO
    const reloaded = await this.professionalRepository.findOne({
      where: { id: saved.id },
      relations: ['user', 'speciality'],
    });
    return this.toProfessionalDto(reloaded!);
  }

  async updateProfessional(
    id: string,
    dto: UpdateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    const professional = await this.professionalRepository.findOne({
      where: { id },
      relations: ['user', 'speciality'],
    });
    if (!professional)
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);

    Object.assign(professional, dto);
    await this.professionalRepository.save(professional);
    this.logger.info(`Professional updated: ${id}`);

    return this.toProfessionalDto(professional);
  }

  async createAvailabilities(
    professionalId: string,
    dto: BulkCreateAvailabilityDto,
  ): Promise<ProfessionalAvailability[]> {
    const professional = await this.professionalRepository.findOne({
      where: { id: professionalId, is_active: true },
    });
    if (!professional)
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);

    // Use a transaction so all slots are inserted or none are
    return this.dataSource.transaction(async (manager) => {
      const slots = dto.slots.map((slot) =>
        manager.create(ProfessionalAvailability, {
          professional_id: professionalId,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: true,
        }),
      );

      try {
        return await manager.save(ProfessionalAvailability, slots);
      } catch (err: unknown) {
        // Unique constraint violation → duplicate slot
        if ((err as { code?: string })?.code === '23505') {
          throw new ConflictException(
            'One or more availability slots conflict with existing records',
          );
        }
        throw err;
      }
    });
  }

  async createReview(
    professionalId: string,
    reviewerId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    // Professional must exist
    const professional = await this.professionalRepository.findOne({
      where: { id: professionalId, is_active: true },
    });
    if (!professional)
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);

    // If booking_id supplied: validate ownership and professional match
    if (dto.booking_id) {
      const booking = await this.bookingRepository.findOne({
        where: { id: dto.booking_id },
      });
      if (
        !booking ||
        booking.patient_id !== reviewerId ||
        booking.professional_id !== professionalId
      ) {
        throw new BadRequestException(sysMsg.REVIEW_INVALID_BOOKING);
      }

      // One review per booking
      const dupReview = await this.reviewRepository.findOne({
        where: { booking_id: dto.booking_id },
      });
      if (dupReview) throw new ConflictException(sysMsg.REVIEW_ALREADY_EXISTS);
    }

    return this.dataSource.transaction(async (manager) => {
      const review = manager.create(ProfessionalReview, {
        reviewer_id: reviewerId,
        professional_id: professionalId,
        booking_id: dto.booking_id,
        rating: dto.rating,
        comment: dto.comment,
      });
      const saved = await manager.save(ProfessionalReview, review);

      // Recompute denormalized rating summary
      const aggregate = await manager
        .getRepository(ProfessionalReview)
        .createQueryBuilder('r')
        .select('AVG(r.rating)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.professional_id = :id', { id: professionalId })
        .getRawOne<{ avg: string; count: string }>();

      professional.rating = parseFloat(aggregate.avg) || 0;
      professional.total_reviews = parseInt(aggregate.count, 10) || 0;
      await manager.save(Professional, professional);

      this.logger.info(
        `Review created: ${saved.id} for professional ${professionalId} by ${reviewerId}`,
      );

      return this.toReviewDto(saved);
    });
  }

  async getReviews(professionalId: string): Promise<ReviewResponseDto[]> {
    const professional = await this.professionalRepository.findOne({
      where: { id: professionalId },
    });
    if (!professional)
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);

    const reviews = await this.reviewRepository.find({
      where: { professional_id: professionalId },
      order: { created_at: 'DESC' },
    });

    return reviews.map(this.toReviewDto);
  }

  private toProfessionalDto = (
    prof: Professional,
  ): ProfessionalResponseDto => ({
    id: prof.id,
    name: `${prof.user.first_name} ${prof.user.last_name}`,
    image: prof.image,
    speciality_id: prof.speciality_id,
    speciality: prof.speciality?.name ?? '',
    rating: Number(prof.rating),
    total_reviews: prof.total_reviews,
    consultation_fee: Number(prof.consultation_fee),
    years_of_experience: prof.years_of_experience,
    about: prof.about,
    consultation_type: prof.consultation_type,
    is_available: prof.is_available,
  });

  private toReviewDto = (review: ProfessionalReview): ReviewResponseDto => ({
    id: review.id,
    reviewer_id: review.reviewer_id,
    professional_id: review.professional_id,
    rating: review.rating,
    comment: review.comment,
    booking_id: review.booking_id,
    created_at: review.created_at,
  });
}
