import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthCapability } from '../auth/context/auth-capability';
import { AUTH_CAPABILITIES_KEY } from '../auth/decorators/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { LaboratoryVerificationStatusController } from './laboratory-verification-status.controller';
import { LaboratoryVerificationStatusService } from './laboratory-verification-status.service';

describe('LaboratoryVerificationStatusController', () => {
  let controller: LaboratoryVerificationStatusController;
  let service: jest.Mocked<LaboratoryVerificationStatusService>;
  let reflector: Reflector;

  const currentUser = {
    id: 'user-id',
    email: 'lab@example.com',
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

  it('should be protected by JWT and capability guards', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      LaboratoryVerificationStatusController,
    );

    expect(guards).toEqual([JwtAuthGuard, CapabilitiesGuard]);
  });

  it('should restrict lab-owned routes to lab admins', () => {
    const routes = [controller.getMyStatus, controller.submitMyVerification];

    routes.forEach((route) => {
      const roles = reflector.get<AuthCapability[]>(
        AUTH_CAPABILITIES_KEY,
        route,
      );

      expect(roles).toEqual([AuthCapability.ORGANIZATION_ONBOARDING]);
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
      const roles = reflector.get<AuthCapability[]>(
        AUTH_CAPABILITIES_KEY,
        route,
      );

      expect(roles).toEqual([AuthCapability.PLATFORM_ORGANIZATION_REVIEW]);
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
