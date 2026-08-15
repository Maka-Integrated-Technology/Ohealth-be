import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { User } from '../user/entities/user.entity';

import { ProfessionalPatientSortBy } from './dto/professional-patient-response.dto';
import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import { Professional } from './entities/professional.entity';
import { ProfessionalService } from './professional.service';

describe('ProfessionalService patient dashboard APIs', () => {
  const professional = {
    id: 'professional-id-1',
    user_id: 'professional-user-id-1',
    user: {
      id: 'professional-user-id-1',
      first_name: 'Dr',
      last_name: 'Ada',
    },
    speciality: { name: 'General Medicine' },
  } as Professional;

  const patient = {
    id: 'patient-id-1',
    first_name: 'Tunde',
    last_name: 'Adebayo',
    email: 'tunde@example.com',
    phone: '+2348012345678',
    image: 'https://example.com/tunde.png',
    gender: 'Male',
    dob: '1994-05-10',
  } as User;

  const secondPatient = {
    id: 'patient-id-2',
    first_name: 'Grace',
    last_name: 'Okeke',
    email: 'grace@example.com',
    phone: null,
    image: null,
    gender: null,
    dob: null,
  } as User;

  const booking = (
    overrides: Partial<Booking> & Pick<Booking, 'id' | 'patient'>,
  ) =>
    ({
      patient_id: overrides.patient.id,
      professional_id: professional.id,
      booking_date: '2026-08-15',
      booking_time: '09:00:00',
      consultation_type: 'video',
      amount: 5000,
      status: BookingStatus.CONFIRMED,
      notes: null,
      is_paid: true,
      created_at: new Date('2026-08-10T09:00:00.000Z'),
      ...overrides,
    }) as Booking;

  let service: ProfessionalService;
  let professionalRepository: jest.Mocked<Partial<Repository<Professional>>>;
  let bookingRepository: jest.Mocked<Partial<Repository<Booking>>>;
  let patientProfileRepository: jest.Mocked<
    Partial<Repository<PatientProfile>>
  >;

  const createQueryBuilder = (bookings: Booking[]) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(bookings),
    };
    return queryBuilder;
  };

  beforeEach(() => {
    professionalRepository = {
      findOne: jest.fn().mockResolvedValue(professional),
    };
    bookingRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    patientProfileRepository = {
      find: jest.fn().mockResolvedValue([
        {
          user_id: patient.id,
          patient_reference: '#HB-00398',
          medical_conditions: ['Asthma'],
          allergies: ['Peanuts'],
          blood_group: 'O+',
          emergency_contact_name: 'Tola Adebayo',
          emergency_contact_phone: '+2348099999999',
        },
        {
          user_id: secondPatient.id,
          patient_reference: '#HB-00376',
          medical_conditions: ['Migraine', 'Anxiety'],
          allergies: null,
          blood_group: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        user_id: patient.id,
        patient_reference: '#HB-00398',
        medical_conditions: ['Asthma'],
        allergies: ['Peanuts'],
        blood_group: 'O+',
        emergency_contact_name: 'Tola Adebayo',
        emergency_contact_phone: '+2348099999999',
      }),
    };

    service = new ProfessionalService(
      professionalRepository as Repository<Professional>,
      {} as Repository<ProfessionalAvailability>,
      {} as Repository<ProfessionalReview>,
      {} as Repository<User>,
      bookingRepository as Repository<Booking>,
      patientProfileRepository as Repository<PatientProfile>,
      {} as never,
      {} as DataSource,
      {
        child: jest.fn().mockReturnValue({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        }),
      } as unknown as Logger,
    );
  });

  it('lists unique patients with consultation counts and latest booking details', async () => {
    const bookings = [
      booking({ id: 'booking-id-2', patient, booking_date: '2026-08-16' }),
      booking({
        id: 'booking-id-1',
        patient,
        booking_date: '2026-08-01',
        status: BookingStatus.COMPLETED,
      }),
      booking({
        id: 'booking-id-3',
        patient: secondPatient,
        booking_date: '2026-08-14',
      }),
    ];
    const queryBuilder = createQueryBuilder(bookings);
    bookingRepository.createQueryBuilder!.mockReturnValue(
      queryBuilder as never,
    );

    const result = await service.getMyPatients('professional-user-id-1');

    expect(professionalRepository.findOne).toHaveBeenCalledWith({
      where: { user_id: 'professional-user-id-1' },
      relations: ['user', 'speciality'],
    });
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'booking.professional_id = :professionalId',
      { professionalId: professional.id },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'booking.status != :cancelled',
      { cancelled: BookingStatus.CANCELLED },
    );
    expect(patientProfileRepository.find).toHaveBeenCalledWith({
      where: { user_id: expect.anything() },
    });
    expect(result).toEqual({
      records: [
        {
          id: patient.id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          full_name: 'Tunde Adebayo',
          patient_reference: '#HB-00398',
          email: patient.email,
          phone: patient.phone,
          image: patient.image,
          gender: patient.gender,
          dob: patient.dob,
          medical_conditions: ['Asthma'],
          allergies: ['Peanuts'],
          blood_group: 'O+',
          emergency_contact_name: 'Tola Adebayo',
          emergency_contact_phone: '+2348099999999',
          condition: 'Asthma',
          total_consultations: 2,
          last_visit_date: '2026-08-16',
          last_booking_id: 'booking-id-2',
          last_booking_status: BookingStatus.CONFIRMED,
        },
        {
          id: secondPatient.id,
          first_name: secondPatient.first_name,
          last_name: secondPatient.last_name,
          full_name: 'Grace Okeke',
          patient_reference: '#HB-00376',
          email: secondPatient.email,
          phone: null,
          image: null,
          gender: null,
          dob: null,
          medical_conditions: ['Migraine', 'Anxiety'],
          allergies: [],
          blood_group: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          condition: 'Migraine, Anxiety',
          total_consultations: 1,
          last_visit_date: '2026-08-14',
          last_booking_id: 'booking-id-3',
          last_booking_status: BookingStatus.CONFIRMED,
        },
      ],
      meta: {
        page: 1,
        limit: 9,
        total: 2,
        total_pages: 1,
        showing: 2,
        has_next: false,
        has_previous: false,
      },
    });
  });

  it('applies a search filter when listing patients', async () => {
    const queryBuilder = createQueryBuilder([]);
    bookingRepository.createQueryBuilder!.mockReturnValue(
      queryBuilder as never,
    );

    await service.getMyPatients('professional-user-id-1', {
      search: '  TUNDE ',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
    expect(queryBuilder.getMany).toHaveBeenCalled();
  });

  it('filters, sorts, and paginates patient records for the table controls', async () => {
    const bookings = [
      booking({ id: 'booking-id-2', patient, booking_date: '2026-08-16' }),
      booking({
        id: 'booking-id-3',
        patient: secondPatient,
        booking_date: '2026-08-14',
      }),
    ];
    const queryBuilder = createQueryBuilder(bookings);
    bookingRepository.createQueryBuilder!.mockReturnValue(
      queryBuilder as never,
    );

    const result = await service.getMyPatients('professional-user-id-1', {
      search: '#HB-00376',
      condition: 'migraine',
      sort_by: ProfessionalPatientSortBy.PATIENT,
      sort_order: 'asc',
      page: '1',
      limit: '1',
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      full_name: 'Grace Okeke',
      patient_reference: '#HB-00376',
      condition: 'Migraine, Anxiety',
    });
    expect(result.meta).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      total_pages: 1,
      showing: 1,
      has_next: false,
      has_previous: false,
    });
  });

  it('rejects invalid pagination and sort query values', async () => {
    const queryBuilder = createQueryBuilder([]);
    bookingRepository.createQueryBuilder!.mockReturnValue(
      queryBuilder as never,
    );

    await expect(
      service.getMyPatients('professional-user-id-1', { page: '0' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getMyPatients('professional-user-id-1', {
        sort_by: 'unsupported' as never,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getMyPatients('professional-user-id-1', {
        sort_order: 'sideways' as never,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns one patient profile with consultation history and lab results placeholder', async () => {
    const bookings = [
      booking({
        id: 'booking-id-1',
        patient,
        booking_date: '2999-08-15',
        booking_time: '09:00:00',
      }),
      booking({
        id: 'booking-id-2',
        patient,
        booking_date: '2026-08-01',
        booking_time: '11:00:00',
        status: BookingStatus.COMPLETED,
      }),
    ];
    bookingRepository.find!.mockResolvedValue(bookings);

    const result = await service.getMyPatientProfile(
      'professional-user-id-1',
      patient.id,
    );

    expect(bookingRepository.find).toHaveBeenCalledWith({
      where: {
        professional_id: professional.id,
        patient_id: patient.id,
      },
      relations: ['patient', 'professional', 'professional.user'],
      order: { booking_date: 'DESC', booking_time: 'DESC' },
    });
    expect(result.profile.full_name).toBe('Tunde Adebayo');
    expect(result.profile).toMatchObject({
      patient_reference: '#HB-00398',
      medical_conditions: ['Asthma'],
      allergies: ['Peanuts'],
      blood_group: 'O+',
      emergency_contact_name: 'Tola Adebayo',
      emergency_contact_phone: '+2348099999999',
    });
    expect(result.summary).toEqual({
      total_consultations: 2,
      completed_consultations: 1,
      upcoming_appointments: 1,
      last_visit_date: '2999-08-15',
    });
    expect(result.consultation_history).toHaveLength(2);
    expect(result.consultation_history[0]).toMatchObject({
      id: 'booking-id-1',
      patient_id: patient.id,
      patient_name: 'Tunde Adebayo',
      professional_id: professional.id,
      booking_date: '2999-08-15',
    });
    expect(result.lab_results).toEqual([]);
  });

  it('rejects patient profile access when the patient has no bookings with the professional', async () => {
    bookingRepository.find!.mockResolvedValue([]);

    await expect(
      service.getMyPatientProfile('professional-user-id-1', patient.id),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.getMyPatientProfile('professional-user-id-1', patient.id),
    ).rejects.toThrow(sysMsg.PATIENT_NOT_FOUND);
  });
});
