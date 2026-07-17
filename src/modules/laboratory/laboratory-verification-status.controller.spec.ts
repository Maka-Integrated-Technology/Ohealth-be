import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryVerificationStatusController } from './laboratory-verification-status.controller';
import { LaboratoryVerificationStatusService } from './laboratory-verification-status.service';

describe('LaboratoryVerificationStatusController', () => {
  let controller: LaboratoryVerificationStatusController;
  let service: jest.Mocked<LaboratoryVerificationStatusService>;
  let reflector: Reflector;

  const currentUser = {
    id: 'user-id',
    email: 'lab@example.com',
    roles: [UserRole.LAB_ADMIN],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaboratoryVerificationStatusController],
      providers: [
        Reflector,
        {
          provide: LaboratoryVerificationStatusService,
          useValue: {
            getMyStatus: jest.fn(),
            submitMyVerification: jest.fn(),
            getStatusForLaboratory: jest.fn(),
            listHistory: jest.fn(),
            markUnderReview: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(LaboratoryVerificationStatusController);
    service = module.get(LaboratoryVerificationStatusService);
    reflector = module.get(Reflector);
  });

  it('should be protected by JWT and roles guards', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      LaboratoryVerificationStatusController,
    );

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('should restrict lab-owned routes to lab admins', () => {
    const routes = [controller.getMyStatus, controller.submitMyVerification];

    routes.forEach((route) => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, route);

      expect(roles).toEqual([UserRole.LAB_ADMIN]);
    });
  });

  it('should restrict review routes to platform admins', () => {
    const routes = [
      controller.getLaboratoryStatus,
      controller.listHistory,
      controller.markUnderReview,
      controller.approve,
      controller.reject,
    ];

    routes.forEach((route) => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, route);

      expect(roles).toEqual([UserRole.ADMIN]);
    });
  });

  it('should delegate current lab status lookup to service with current user id', async () => {
    service.getMyStatus.mockResolvedValue({} as never);

    await controller.getMyStatus(currentUser);

    expect(service.getMyStatus).toHaveBeenCalledWith('user-id');
  });

  it('should delegate submit to service with current user id', async () => {
    service.submitMyVerification.mockResolvedValue({} as never);

    await controller.submitMyVerification(currentUser);

    expect(service.submitMyVerification).toHaveBeenCalledWith('user-id');
  });

  it('should delegate admin review actions with laboratory and actor ids', async () => {
    service.markUnderReview.mockResolvedValue({} as never);
    service.approve.mockResolvedValue({} as never);
    service.reject.mockResolvedValue({} as never);

    await controller.markUnderReview(currentUser, 'laboratory-id');
    await controller.approve(currentUser, 'laboratory-id');
    await controller.reject(currentUser, 'laboratory-id', {
      reason: 'Invalid document',
    });

    expect(service.markUnderReview).toHaveBeenCalledWith(
      'laboratory-id',
      'user-id',
    );
    expect(service.approve).toHaveBeenCalledWith('laboratory-id', 'user-id');
    expect(service.reject).toHaveBeenCalledWith('laboratory-id', 'user-id', {
      reason: 'Invalid document',
    });
  });
});
