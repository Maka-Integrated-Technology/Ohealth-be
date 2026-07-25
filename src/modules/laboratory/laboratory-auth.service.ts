import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { AuthService } from '../auth/auth.service';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import { LaboratoryAdminSetupDto } from './dto/laboratory-admin-setup.dto';
import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryOnboardingStatus } from './enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from './enums/laboratory-verification-status.enum';
import { ILaboratoryAdminSetupResult } from './interfaces/laboratory-admin-setup-result.interface';
import {
  INormalizedLaboratoryAdministratorPayload,
  INormalizedLaboratoryPayload,
} from './interfaces/normalized-laboratory-admin-setup.interface';
import { IParsedFullName } from './interfaces/parsed-full-name.interface';

@Injectable()
export class LaboratoryAuthService {
  private readonly logger: Logger;
  private readonly saltRounds: number;

  constructor(
    @InjectRepository(Laboratory)
    private readonly laboratoryRepository: Repository<Laboratory>,
    @InjectRepository(LaboratoryAdmin)
    private readonly laboratoryAdminRepository: Repository<LaboratoryAdmin>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: LaboratoryAuthService.name });
    this.saltRounds = Number(this.configService.get<string>('HASH_SALT', '10'));
  }

  async setupAdministrator(
    dto: LaboratoryAdminSetupDto,
  ): Promise<ILaboratoryAdminSetupResult> {
    const laboratoryPayload = this.normalizeLaboratoryPayload(dto);
    const administratorPayload = this.normalizeAdministratorPayload(dto);
    const parsedName = this.parseFullName(administratorPayload.fullName);
    const password = await bcrypt.hash(
      administratorPayload.password,
      this.saltRounds,
    );

    const { laboratory, administrator, user } =
      await this.createLaboratoryAndAdministrator(
        laboratoryPayload,
        administratorPayload,
        parsedName,
        password,
      );
    const authSession = await this.authService.issueAuthSession(user);

    this.logger.info(sysMsg.LABORATORY_ADMIN_SETUP_COMPLETED, {
      laboratory_id: laboratory.id,
      user_id: user.id,
    });

    return {
      message: sysMsg.LABORATORY_ADMIN_SETUP_COMPLETED,
      laboratory: {
        id: laboratory.id,
        name: laboratory.name,
        registration_number: laboratory.registration_number,
        license_number: laboratory.license_number,
        address: laboratory.address,
        region: laboratory.region,
        contact_email: laboratory.contact_email,
        contact_phone: laboratory.contact_phone,
        verification_status: laboratory.verification_status,
        verification_rejection_reason:
          laboratory.verification_rejection_reason ?? null,
        onboarding_status: laboratory.onboarding_status,
        is_active: laboratory.is_active,
        created_at: laboratory.created_at,
      },
      administrator: {
        id: administrator.id,
        user_id: user.id,
        full_name: administrator.full_name,
        email: user.email,
        phone: administrator.phone,
        role: user.role,
        is_primary: administrator.is_primary,
      },
      ...authSession,
    };
  }

  private async createLaboratoryAndAdministrator(
    laboratoryPayload: INormalizedLaboratoryPayload,
    administratorPayload: INormalizedLaboratoryAdministratorPayload,
    parsedName: IParsedFullName,
    password: string,
  ): Promise<{
    laboratory: Laboratory;
    administrator: LaboratoryAdmin;
    user: User;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const laboratoryRepository = manager.withRepository(
          this.laboratoryRepository,
        );
        const laboratoryAdminRepository = manager.withRepository(
          this.laboratoryAdminRepository,
        );
        const userRepository = manager.withRepository(this.userRepository);

        const existingUser = await userRepository.findOne({
          where: { email: administratorPayload.email },
        });
        if (existingUser) {
          throw new ConflictException(
            sysMsg.LABORATORY_ADMIN_EMAIL_ALREADY_REGISTERED,
          );
        }

        const existingLaboratory = await laboratoryRepository.findOne({
          where: [
            { registration_number: laboratoryPayload.registrationNumber },
            { license_number: laboratoryPayload.licenseNumber },
          ],
        });
        if (existingLaboratory) {
          throw new ConflictException(sysMsg.LABORATORY_ALREADY_EXISTS);
        }

        const laboratory = await laboratoryRepository.save(
          laboratoryRepository.create({
            name: laboratoryPayload.name,
            registration_number: laboratoryPayload.registrationNumber,
            license_number: laboratoryPayload.licenseNumber,
            address: laboratoryPayload.address,
            region: laboratoryPayload.region,
            contact_email: laboratoryPayload.contactEmail,
            contact_phone: laboratoryPayload.contactPhone,
            verification_status: LaboratoryVerificationStatus.PENDING,
            verification_rejection_reason: null,
            onboarding_status: LaboratoryOnboardingStatus.ADMIN_SETUP_COMPLETED,
            is_active: true,
          }),
        );

        const user = await userRepository.save(
          userRepository.create({
            email: administratorPayload.email,
            password,
            first_name: parsedName.firstName,
            last_name: parsedName.lastName,
            middle_name: parsedName.middleName,
            phone: administratorPayload.phone,
            role: [UserRole.LAB_ADMIN],
            is_active: true,
            is_verified: true,
          }),
        );

        const administrator = await laboratoryAdminRepository.save(
          laboratoryAdminRepository.create({
            laboratory_id: laboratory.id,
            user_id: user.id,
            full_name: administratorPayload.fullName,
            phone: administratorPayload.phone,
            is_primary: true,
          }),
        );

        return { laboratory, administrator, user };
      });
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException(sysMsg.LABORATORY_ALREADY_EXISTS);
      }

      throw error;
    }
  }

  private normalizeLaboratoryPayload(
    dto: LaboratoryAdminSetupDto,
  ): INormalizedLaboratoryPayload {
    return {
      name: dto.laboratory.name.trim(),
      registrationNumber: dto.laboratory.registration_number.trim(),
      licenseNumber: dto.laboratory.license_number.trim(),
      address: dto.laboratory.address.trim(),
      region: dto.laboratory.region.trim(),
      contactEmail: dto.laboratory.contact_email.trim().toLowerCase(),
      contactPhone: dto.laboratory.contact_phone.trim(),
    };
  }

  private normalizeAdministratorPayload(
    dto: LaboratoryAdminSetupDto,
  ): INormalizedLaboratoryAdministratorPayload {
    return {
      fullName: dto.administrator.full_name.trim().replace(/\s+/g, ' '),
      email: dto.administrator.email.trim().toLowerCase(),
      phone: dto.administrator.phone.trim(),
      password: dto.administrator.password,
    };
  }

  private parseFullName(fullName: string): IParsedFullName {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const [firstName, ...remainingNames] = parts;

    if (!remainingNames.length) {
      return {
        firstName,
        lastName: 'Administrator',
        middleName: null,
      };
    }

    return {
      firstName,
      lastName: remainingNames[remainingNames.length - 1],
      middleName:
        remainingNames.length > 1
          ? remainingNames.slice(0, remainingNames.length - 1).join(' ')
          : null,
    };
  }
}
