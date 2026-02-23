import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Repository } from 'typeorm';
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

    // Validate professional exists
    const professional = await this.professionalRepository.findOne({
      where: { id: professional_id, is_active: true },
    });

    if (!professional) {
      this.logger.warn(`Professional not found: ${professional_id}`);
      throw new NotFoundException(sysMsg.PROFESSIONAL_NOT_FOUND);
    }

    // Check if professional supports consultation type
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

    // Check availability
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
        `Time slot not available for professional ${professional_id} on ${booking_date} at ${booking_time}`,
      );
      throw new BadRequestException(sysMsg.TIME_SLOT_NOT_AVAILABLE);
    }

    // Check for existing booking
    const existingBooking = await this.bookingRepository.findOne({
      where: {
        professional_id,
        booking_date,
        booking_time,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (existingBooking) {
      this.logger.warn(
        `Time slot already booked for professional ${professional_id} on ${booking_date} at ${booking_time}`,
      );
      throw new ConflictException(sysMsg.TIME_SLOT_ALREADY_BOOKED);
    }

    // Create booking
    const booking = this.bookingRepository.create({
      patient_id: patientId,
      professional_id,
      booking_date,
      booking_time,
      consultation_type,
      amount: professional.consultation_fee,
      notes,
      status: BookingStatus.PENDING,
    });

    const savedBooking = await this.bookingRepository.save(booking);

    this.logger.info(
      `Booking created: ${savedBooking.id} for patient ${patientId}`,
    );

    return {
      id: savedBooking.id,
      patient_id: savedBooking.patient_id,
      professional_id: savedBooking.professional_id,
      booking_date: savedBooking.booking_date,
      booking_time: savedBooking.booking_time,
      consultation_type: savedBooking.consultation_type,
      amount: Number(savedBooking.amount),
      status: savedBooking.status,
      notes: savedBooking.notes,
      is_paid: savedBooking.is_paid,
      created_at: savedBooking.created_at,
    };
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

    return bookings.map((booking) => ({
      id: booking.id,
      patient_id: booking.patient_id,
      professional_id: booking.professional_id,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      consultation_type: booking.consultation_type,
      amount: Number(booking.amount),
      status: booking.status,
      notes: booking.notes,
      is_paid: booking.is_paid,
      created_at: booking.created_at,
    }));
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

    return {
      id: booking.id,
      patient_id: booking.patient_id,
      professional_id: booking.professional_id,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      consultation_type: booking.consultation_type,
      amount: Number(booking.amount),
      status: booking.status,
      notes: booking.notes,
      is_paid: booking.is_paid,
      created_at: booking.created_at,
    };
  }

  async cancelBooking(id: string, userId: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepository.findOne({
      where: { id, patient_id: userId },
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

    booking.status = BookingStatus.CANCELLED;
    const updatedBooking = await this.bookingRepository.save(booking);

    this.logger.info(`Booking cancelled: ${id} by user ${userId}`);

    return {
      id: updatedBooking.id,
      patient_id: updatedBooking.patient_id,
      professional_id: updatedBooking.professional_id,
      booking_date: updatedBooking.booking_date,
      booking_time: updatedBooking.booking_time,
      consultation_type: updatedBooking.consultation_type,
      amount: Number(updatedBooking.amount),
      status: updatedBooking.status,
      notes: updatedBooking.notes,
      is_paid: updatedBooking.is_paid,
      created_at: updatedBooking.created_at,
    };
  }
}
