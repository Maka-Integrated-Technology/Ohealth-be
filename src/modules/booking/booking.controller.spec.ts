import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

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

  it('protects every patient booking route with JWT and role guards', () => {
    const guards = Reflect.getMetadata('__guards__', BookingController);
    const roles = reflector.get<UserRole[]>(ROLES_KEY, BookingController);

    expect(controller).toBeDefined();
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(roles).toEqual([UserRole.PATIENT]);
  });
});
