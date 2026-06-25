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
import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import { Professional } from '../professional/entities/professional.entity';

import { BookingResponseDto } from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking, BookingStatus } from './entities/booking.entity';

@Injectable()
export class BookingService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalAvailability)
    private readonly availabilityRepository: Repository<ProfessionalAvailability>,
    private readonly dataSource: DataSource,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: BookingService.name });
  }

  async create(
    patientId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    const {
      professional_id,
      booking_date,
      booking_time,
      consultation_type,
      notes,
    } = createBookingDto;

    // ── 1. Date must not be in the past ────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parsedDate = new Date(booking_date);
    if (isNaN(parsedDate.getTime()) || parsedDate < today) {
      throw new BadRequestException(sysMsg.BOOKING_INVALID_DATE);
    }

    // ── 2. Time must be HH:MM ──────────────────────────────────────────
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(booking_time)) {
      throw new BadRequestException(sysMsg.BOOKING_INVALID_TIME);
    }

    // ── 3. Professional must exist and be active ───────────────────────
    const professional = await this.professionalRepository.findOne({
      where: { id: professional_id, is_active: true },
      relations: ['user', 'speciality'],
    });
    if (!professional) {
      this.logger.warn(`Professional not found: ${professional_id}`);
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);
    }

    // ── 4. Professional must support the requested consultation type ───
    if (
      professional.consultation_type !== 'both' &&
      professional.consultation_type !== consultation_type
    ) {
      this.logger.warn(
        `Professional ${professional_id} does not support ${consultation_type}`,
      );
      throw new BadRequestException(
        `${sysMsg.CONSULTATION_TYPE_NOT_SUPPORTED}: ${consultation_type}`,
      );
    }

    // ── 5. Availability slot must exist ────────────────────────────────
    const availability = await this.availabilityRepository.findOne({
      where: {
        professional_id,
        date: booking_date,
        start_time: booking_time,
        is_available: true,
      },
    });
    if (!availability) {
      this.logger.warn(
        `Time slot not available: professional=${professional_id} date=${booking_date} time=${booking_time}`,
      );
      throw new BadRequestException(sysMsg.TIME_SLOT_NOT_AVAILABLE);
    }

    // ── 6. Prevent duplicate pending OR confirmed bookings ────────────
    const existingBooking = await this.bookingRepository.findOne({
      where: [
        {
          professional_id,
          booking_date,
          booking_time,
          status: BookingStatus.PENDING,
        },
        {
          professional_id,
          booking_date,
          booking_time,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    if (existingBooking) {
      this.logger.warn(
        `Slot already booked: professional=${professional_id} date=${booking_date} time=${booking_time}`,
      );
      throw new ConflictException(sysMsg.TIME_SLOT_ALREADY_BOOKED);
    }

    // ── 7. Create booking + mark slot unavailable in one transaction ───
    const savedBooking = await this.dataSource.transaction(async (manager) => {
      // Re-read with pessimistic write lock to handle concurrent requests
      const slot = await manager.findOne(ProfessionalAvailability, {
        where: { id: availability.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!slot || !slot.is_available) {
        throw new ConflictException(sysMsg.TIME_SLOT_ALREADY_BOOKED);
      }

      slot.is_available = false;
      await manager.save(ProfessionalAvailability, slot);

      const booking = manager.create(Booking, {
        patient_id: patientId,
        professional_id,
        booking_date,
        booking_time,
        consultation_type,
        amount: professional.consultation_fee,
        availability_id: slot.id,
        notes,
        status: BookingStatus.PENDING,
      });

      return manager.save(Booking, booking);
    });

    this.logger.info(
      `Booking created: ${savedBooking.id} for patient ${patientId}`,
    );

    return this.toDto(savedBooking, professional);
  }

  async findUserBookings(userId: string): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingRepository.find({
      where: { patient_id: userId },
      relations: [
        'professional',
        'professional.user',
        'professional.speciality',
      ],
      order: { created_at: 'DESC' },
    });

    return bookings.map((b) => this.toDto(b, b.professional));
  }

  async findOne(id: string, userId: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepository.findOne({
      where: { id, patient_id: userId },
      relations: [
        'professional',
        'professional.user',
        'professional.speciality',
      ],
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ${id} for user ${userId}`);
      throw new NotFoundException(sysMsg.BOOKING_NOT_FOUND);
    }

    return this.toDto(booking, booking.professional);
  }

  async cancelBooking(id: string, userId: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepository.findOne({
      where: { id, patient_id: userId },
      relations: [
        'professional',
        'professional.user',
        'professional.speciality',
      ],
    });

    if (!booking) {
      this.logger.warn(`Booking not found for cancellation: ${id}`);
      throw new NotFoundException(sysMsg.BOOKING_NOT_FOUND);
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException(sysMsg.BOOKING_CANNOT_CANCEL_COMPLETED);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(sysMsg.BOOKING_ALREADY_CANCELLED);
    }

    const updatedBooking = await this.dataSource.transaction(
      async (manager) => {
        booking.status = BookingStatus.CANCELLED;
        const saved = await manager.save(Booking, booking);

        // Restore the availability slot if this booking had one linked
        if (booking.availability_id) {
          await manager.update(
            ProfessionalAvailability,
            { id: booking.availability_id },
            { is_available: true },
          );
        }

        return saved;
      },
    );

    this.logger.info(`Booking cancelled: ${id} by user ${userId}`);

    return this.toDto(updatedBooking, booking.professional);
  }

  private toDto(
    booking: Booking,
    professional: Professional,
  ): BookingResponseDto {
    const professionalName = professional?.user
      ? `${professional.user.first_name} ${professional.user.last_name}`
      : '';

    return {
      id: booking.id,
      patient_id: booking.patient_id,
      professional_id: booking.professional_id,
      professional_name: professionalName,
      professional_image: professional?.image,
      speciality_id: professional?.speciality_id ?? '',
      speciality_name: professional?.speciality?.name ?? '',
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      consultation_type: booking.consultation_type,
      amount: Number(booking.amount),
      status: booking.status,
      payment_status: booking.is_paid ? 'paid' : 'unpaid',
      notes: booking.notes,
      is_paid: booking.is_paid,
      created_at: booking.created_at,
    };
  }
}
