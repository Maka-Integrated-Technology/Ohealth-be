import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Booking, BookingStatus } from './entities/booking.entity';
import { Professional } from '../professional/entities/professional.entity';
import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(ProfessionalAvailability)
    private readonly availabilityRepository: Repository<ProfessionalAvailability>,
  ) {}

  async create(
    patientId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    const { professional_id, booking_date, booking_time, consultation_type, notes } =
      createBookingDto;

    // Validate professional exists
    const professional = await this.professionalRepository.findOne({
      where: { id: professional_id, is_active: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    // Check if professional supports consultation type
    if (
      professional.consultation_type !== 'both' &&
      professional.consultation_type !== consultation_type
    ) {
      throw new BadRequestException(
        `Professional does not support ${consultation_type} consultation`,
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
      throw new BadRequestException('Selected time slot is not available');
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
      throw new ConflictException('Time slot already booked');
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
      relations: ['professional', 'professional.user', 'professional.speciality'],
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
      relations: ['professional', 'professional.user', 'professional.speciality'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
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
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed booking');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking already cancelled');
    }

    booking.status = BookingStatus.CANCELLED;
    const updatedBooking = await this.bookingRepository.save(booking);

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
