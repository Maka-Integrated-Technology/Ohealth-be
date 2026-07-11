import { Test, TestingModule } from '@nestjs/testing';

import * as sysMsg from '../../constants/system.messages';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryAdminSetupDto } from './dto/laboratory-admin-setup.dto';
import { LaboratoryAuthController } from './laboratory-auth.controller';
import { LaboratoryAuthService } from './laboratory-auth.service';

describe('LaboratoryAuthController', () => {
  let controller: LaboratoryAuthController;
  let service: LaboratoryAuthService;

  const mockLaboratoryAuthService = {
    setupAdministrator: jest.fn(),
  };

  const payload: LaboratoryAdminSetupDto = {
    laboratory: {
      name: 'MedCheck Diagnostics',
      registration_number: 'RC-123456',
      license_number: 'LAB-987654',
      address: '12 Admiralty Way, Lekki',
      region: 'Lagos',
      contact_email: 'hello@medcheck.example',
      contact_phone: '+2348012345678',
    },
    administrator: {
      full_name: 'Tunde Adebayo',
      email: 'tunde@medcheck.example',
      phone: '+2348098765432',
      password: 'SecurePassword123',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaboratoryAuthController],
      providers: [
        {
          provide: LaboratoryAuthService,
          useValue: mockLaboratoryAuthService,
        },
      ],
    }).compile();

    controller = module.get<LaboratoryAuthController>(LaboratoryAuthController);
    service = module.get<LaboratoryAuthService>(LaboratoryAuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should restrict administrator setup to platform admins', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.setupAdministrator);

    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('should delegate administrator setup to the service', async () => {
    const expected = {
      message: sysMsg.LABORATORY_ADMIN_SETUP_COMPLETED,
      laboratory: { id: 'laboratory-id' },
      administrator: { id: 'administrator-id' },
    };
    mockLaboratoryAuthService.setupAdministrator.mockResolvedValue(expected);

    const result = await controller.setupAdministrator(payload);

    expect(service.setupAdministrator).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });
});
