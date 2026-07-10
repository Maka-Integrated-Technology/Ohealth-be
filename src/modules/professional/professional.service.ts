import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import { SpecialityService } from '../speciality/speciality.service';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { BulkCreateAvailabilityDto } from './dto/create-professional-availability.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ProfessionalAppointmentResponseDto,
  ProfessionalDashboardResponseDto,
} from './dto/professional-dashboard-response.dto';
import {
  ProfessionalMeProfileDto,
  ProfessionalMeResponseDto,
  ProfessionalSetupStatus,
} from './dto/professional-me-response.dto';
import {
  ProfessionalDetailResponseDto,
  ProfessionalResponseDto,
} from './dto/professional-response.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { UpsertProfessionalProfileDto } from './dto/upsert-professional-profile.dto';
import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import {
  Professional,
  ProfessionalVerificationStatus,
} from './entities/professional.entity';

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

  async findMe(userId: string): Promise<ProfessionalMeResponseDto> {
    const user = await this.findUserOrThrow(userId);
    const professional = await this.professionalRepository.findOne({
      where: { user_id: userId },
      relations: ['user', 'speciality'],
    });
    const availabilityCount = professional
      ? await this.availabilityRepository.count({
          where: { professional_id: professional.id },
        })
      : 0;

    return this.toProfessionalMeResponse(user, professional, availabilityCount);
  }

  async upsertMeProfile(
    userId: string,
    dto: UpsertProfessionalProfileDto,
  ): Promise<ProfessionalMeResponseDto> {
    const user = await this.findUserOrThrow(userId);
    this.assertProfessionalUser(user);

    await this.specialityService.findOne(dto.speciality_id);

    let professional = await this.professionalRepository.findOne({
      where: { user_id: userId },
      relations: ['user', 'speciality'],
    });
    const licenseChanged =
      !!professional && professional.license_number !== dto.license_number;

    if (!professional) {
      professional = this.professionalRepository.create({
        user_id: userId,
        speciality_id: dto.speciality_id,
        license_number: dto.license_number,
        years_of_experience: dto.years_of_experience,
        consultation_type: dto.consultation_type,
        about: dto.about,
        image: dto.image,
        consultation_fee: dto.consultation_fee ?? 0,
        verification_status: ProfessionalVerificationStatus.PENDING,
      });
    } else {
      Object.assign(professional, {
        speciality_id: dto.speciality_id,
        license_number: dto.license_number,
        years_of_experience: dto.years_of_experience,
        consultation_type: dto.consultation_type,
        about: dto.about ?? professional.about,
        image: dto.image ?? professional.image,
        consultation_fee: dto.consultation_fee ?? professional.consultation_fee,
      });

      if (
        licenseChanged &&
        professional.verification_status ===
          ProfessionalVerificationStatus.VERIFIED
      ) {
        professional.verification_status =
          ProfessionalVerificationStatus.PENDING;
      }
    }

    try {
      await this.professionalRepository.save(professional);
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') {
        throw new ConflictException(
          'professional license number already exists',
        );
      }
      throw err;
    }

    const reloaded = await this.findProfessionalByUserOrThrow(userId);
    const availabilityCount = await this.availabilityRepository.count({
      where: { professional_id: reloaded.id },
    });
    await this.syncProfileSetupCompleted(reloaded, availabilityCount);

    return this.toProfessionalMeResponse(user, reloaded, availabilityCount);
  }

  async createMyAvailabilities(
    userId: string,
    dto: BulkCreateAvailabilityDto,
  ): Promise<ProfessionalAvailability[]> {
    const professional = await this.findProfessionalByUserOrThrow(userId);
    const created = await this.createAvailabilities(professional.id, dto);
    const availabilityCount = await this.availabilityRepository.count({
      where: { professional_id: professional.id },
    });
    await this.syncProfileSetupCompleted(professional, availabilityCount);

    return created;
  }

  async getMyDashboard(
    userId: string,
    date?: string,
  ): Promise<ProfessionalDashboardResponseDto> {
    const professional = await this.findProfessionalByUserOrThrow(userId);
    const dashboardDate = this.normalizeDate(date);

    const [
      todaysAppointments,
      appointmentRequests,
      patientCount,
      currentPeriodPatientCount,
      previousPeriodPatientCount,
      availabilityCount,
    ] = await Promise.all([
      this.bookingRepository.find({
        where: {
          professional_id: professional.id,
          booking_date: dashboardDate,
          status: BookingStatus.CONFIRMED,
        },
        relations: ['patient', 'professional', 'professional.user'],
        order: { booking_time: 'ASC' },
      }),
      this.bookingRepository.find({
        where: {
          professional_id: professional.id,
          status: BookingStatus.PENDING,
        },
        relations: ['patient', 'professional', 'professional.user'],
        order: { created_at: 'DESC' },
        take: 10,
      }),
      this.countDistinctPatients(professional.id),
      this.countDistinctPatientsInRange(
        professional.id,
        this.shiftDate(dashboardDate, -29),
        dashboardDate,
      ),
      this.countDistinctPatientsInRange(
        professional.id,
        this.shiftDate(dashboardDate, -59),
        this.shiftDate(dashboardDate, -30),
      ),
      this.availabilityRepository.count({
        where: { professional_id: professional.id },
      }),
    ]);

    const setup = this.toSetupStatus(professional, availabilityCount);

    return {
      date: dashboardDate,
      profile: this.toProfessionalMeProfileDto(professional),
      stats: {
        patients: patientCount,
        patient_growth_percent: this.calculatePercentChange(
          currentPeriodPatientCount,
          previousPeriodPatientCount,
        ),
        todays_appointments: todaysAppointments.length,
        pending_appointments: appointmentRequests.length,
      },
      todays_appointments: todaysAppointments.map(this.toAppointmentDto),
      appointment_requests: appointmentRequests.map(this.toAppointmentDto),
      activities: this.buildDashboardActivities(professional),
      setup,
    };
  }

  async acceptMyBooking(
    userId: string,
    bookingId: string,
  ): Promise<ProfessionalAppointmentResponseDto> {
    const professional = await this.findProfessionalByUserOrThrow(userId);
    const booking = await this.findMyBookingOrThrow(professional.id, bookingId);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('only pending bookings can be accepted');
    }

    booking.status = BookingStatus.CONFIRMED;
    const saved = await this.bookingRepository.save(booking);
    this.logger.info(`Booking accepted: ${bookingId} by professional ${userId}`);

    return this.toAppointmentDto(saved);
  }

  async rejectMyBooking(
    userId: string,
    bookingId: string,
  ): Promise<ProfessionalAppointmentResponseDto> {
    const professional = await this.findProfessionalByUserOrThrow(userId);
    const booking = await this.findMyBookingOrThrow(professional.id, bookingId);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('only pending bookings can be rejected');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      booking.status = BookingStatus.CANCELLED;
      const updated = await manager.save(Booking, booking);

      if (booking.availability_id) {
        await manager.update(
          ProfessionalAvailability,
          { id: booking.availability_id },
          { is_available: true },
        );
      }

      return updated;
    });
    this.logger.info(`Booking rejected: ${bookingId} by professional ${userId}`);

    return this.toAppointmentDto(saved);
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
      license_number: dto.license_number,
      years_of_experience: dto.years_of_experience ?? 0,
      consultation_fee: dto.consultation_fee,
      consultation_type: dto.consultation_type,
      verification_status:
        dto.verification_status ?? ProfessionalVerificationStatus.PENDING,
    });

    let saved: Professional;
    try {
      saved = await this.professionalRepository.save(professional);
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') {
        throw new ConflictException(
          'professional license number already exists',
        );
      }
      throw err;
    }
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

  private async findUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(sysMsg.USER_NOT_FOUND);
    return user;
  }

  private assertProfessionalUser(user: User): void {
    const hasProfessionalRole = (user.role ?? []).some((role) =>
      PROFESSIONAL_ROLES.includes(role as UserRole),
    );

    if (!hasProfessionalRole) {
      throw new ForbiddenException(sysMsg.PROFESSIONAL_INVALID_ROLE);
    }
  }

  private async findProfessionalByUserOrThrow(
    userId: string,
  ): Promise<Professional> {
    const professional = await this.professionalRepository.findOne({
      where: { user_id: userId },
      relations: ['user', 'speciality'],
    });

    if (!professional) {
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);
    }

    return professional;
  }

  private async findMyBookingOrThrow(
    professionalId: string,
    bookingId: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, professional_id: professionalId },
      relations: ['patient', 'professional', 'professional.user'],
    });

    if (!booking) {
      throw new NotFoundException(sysMsg.BOOKING_NOT_FOUND);
    }

    return booking;
  }

  private async countDistinctPatients(professionalId: string): Promise<number> {
    const result = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('COUNT(DISTINCT booking.patient_id)', 'count')
      .where('booking.professional_id = :professionalId', { professionalId })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .getRawOne<{ count: string }>();

    return parseInt(result?.count ?? '0', 10);
  }

  private async countDistinctPatientsInRange(
    professionalId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('COUNT(DISTINCT booking.patient_id)', 'count')
      .where('booking.professional_id = :professionalId', { professionalId })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .andWhere('booking.booking_date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne<{ count: string }>();

    return parseInt(result?.count ?? '0', 10);
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private normalizeDate(date?: string): string {
    const value = date ?? new Date().toISOString().slice(0, 10);
    const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (!isValidFormat || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    return value;
  }

  private shiftDate(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private async syncProfileSetupCompleted(
    professional: Professional,
    availabilityCount: number,
  ): Promise<void> {
    const setup = this.toSetupStatus(professional, availabilityCount);
    if (professional.profile_setup_completed === setup.completed) return;

    professional.profile_setup_completed = setup.completed;
    await this.professionalRepository.save(professional);
  }

  private toProfessionalMeResponse(
    user: User,
    professional: Professional | null,
    availabilityCount: number,
  ): ProfessionalMeResponseDto {
    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        roles: user.role,
        is_verified: user.is_verified,
      },
      profile: professional
        ? this.toProfessionalMeProfileDto(professional)
        : null,
      setup: this.toSetupStatus(professional, availabilityCount),
    };
  }

  private toSetupStatus(
    professional: Professional | null,
    availabilityCount: number,
  ): ProfessionalSetupStatus {
    const verified =
      professional?.verification_status ===
      ProfessionalVerificationStatus.VERIFIED;
    const setAvailability = availabilityCount > 0;
    const addProfilePhoto = !!professional?.image;
    const addDescription = !!professional?.about?.trim();

    return {
      verified,
      set_availability: setAvailability,
      add_profile_photo: addProfilePhoto,
      add_description: addDescription,
      completed:
        verified && setAvailability && addProfilePhoto && addDescription,
    };
  }

  private toProfessionalMeProfileDto = (
    professional: Professional,
  ): ProfessionalMeProfileDto => ({
    id: professional.id,
    user_id: professional.user_id,
    speciality_id: professional.speciality_id,
    speciality: professional.speciality?.name ?? '',
    image: professional.image,
    about: professional.about,
    license_number: professional.license_number,
    years_of_experience: professional.years_of_experience,
    consultation_fee: Number(professional.consultation_fee),
    consultation_type: professional.consultation_type,
    verification_status: professional.verification_status,
    profile_setup_completed: professional.profile_setup_completed,
    is_available: professional.is_available,
    created_at: professional.created_at,
    updated_at: professional.updated_at,
  });

  private toAppointmentDto = (
    booking: Booking,
  ): ProfessionalAppointmentResponseDto => ({
    id: booking.id,
    patient_id: booking.patient_id,
    patient_name: booking.patient
      ? `${booking.patient.first_name} ${booking.patient.last_name}`
      : '',
    professional_id: booking.professional_id,
    booking_date: booking.booking_date,
    booking_time: booking.booking_time,
    consultation_type: booking.consultation_type,
    amount: Number(booking.amount),
    status: booking.status,
    notes: booking.notes,
    is_paid: booking.is_paid,
    created_at: booking.created_at,
  });

  private buildDashboardActivities(professional: Professional) {
    if (
      professional.verification_status ===
      ProfessionalVerificationStatus.VERIFIED
    ) {
      return [
        {
          title: 'Verification is successful',
          message:
            'Congratulations! Your credentials have been successfully verified. You now have full access to the OHealth+ professional dashboard.',
          occurred_at: professional.updated_at,
        },
      ];
    }

    if (
      professional.verification_status ===
      ProfessionalVerificationStatus.REJECTED
    ) {
      return [
        {
          title: 'Verification rejected',
          message:
            'Your submitted credentials could not be verified. Update your professional profile and submit the correct information.',
          occurred_at: professional.updated_at,
        },
      ];
    }

    return [
      {
        title: 'Awaiting Verification',
        message:
          'Your documents have been submitted successfully. Our team is reviewing your information and will notify you once your account has been approved.',
        occurred_at: professional.updated_at,
      },
    ];
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
