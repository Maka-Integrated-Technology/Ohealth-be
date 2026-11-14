import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthCapability } from '../auth/context/auth-capability';
import { AuthContextService } from '../auth/context/auth-context.service';
import { AUTH_CAPABILITIES_KEY } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

describe('BookingController', () => {
  let controller: BookingController;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        Reflector,
        CapabilitiesGuard,
        {
          provide: AuthContextService,
          useValue: { assertCapabilities: jest.fn() },
        },
        {
          provide: BookingService,
          useValue: {
            create: jest.fn(),
            findUserBookings: jest.fn(),
            findOne: jest.fn(),
            cancelBooking: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(BookingController);
    reflector = module.get(Reflector);
  });

  it('protects every patient booking route with JWT and canonical capability guard', () => {
    const guards = Reflect.getMetadata('__guards__', BookingController);
    const capabilities = reflector.get<AuthCapability[]>(
      AUTH_CAPABILITIES_KEY,
      BookingController,
    );

    expect(controller).toBeDefined();
    expect(guards).toEqual([JwtAuthGuard, CapabilitiesGuard]);
    expect(capabilities).toEqual([AuthCapability.PATIENT_BOOKINGS]);
  });
});
