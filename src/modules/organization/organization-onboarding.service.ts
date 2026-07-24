import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';

import * as sysMsg from '../../constants/system.messages';
import { User } from '../user/entities/user.entity';

import { ORGANIZATION_ADMIN_ROLE } from './constants/organization-role.constant';
import { SetupOrganizationResponseDto } from './dto/organization-response.dto';
import { SetupOrganizationDto } from './dto/organization-setup.dto';
import { OrganizationAdmin } from './entities/organization-admin.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationType } from './enums/organization-type.enum';
import { OrganizationVerificationStatus } from './enums/organization-verification-status.enum';
import {
  ICreatedOrganizationAdministrator,
  INormalizedOrganizationAdministrator,
  INormalizedOrganizationSetup,
  IParsedAdministratorName,
} from './interfaces/organization-onboarding.interface';

@Injectable()
export class OrganizationOnboardingService {
  private readonly logger: Logger;
  private readonly saltRounds: number;

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationAdmin)
    private readonly administratorRepository: Repository<OrganizationAdmin>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({
      context: OrganizationOnboardingService.name,
    });
    this.saltRounds = Number(this.configService.get<string>('HASH_SALT', '10'));
  }

  async setupAdministrator(
    dto: SetupOrganizationDto,
  ): Promise<SetupOrganizationResponseDto> {
    const organization = this.normalizeOrganization(dto);
    const administrator = this.normalizeAdministrator(dto);
    const parsedName = this.parseFullName(administrator.fullName);
    const hashedPassword = await bcrypt.hash(
      administrator.password,
      this.saltRounds,
    );

    const result = await this.createOrganizationAndAdministrator(
      organization,
      administrator,
      parsedName,
      hashedPassword,
    );

    this.logger.info(sysMsg.ORGANIZATION_ADMIN_SETUP_COMPLETED, {
      organization_id: result.organization.id,
      user_id: result.user.id,
    });

    return {
      message: sysMsg.ORGANIZATION_ADMIN_SETUP_COMPLETED,
      organization: {
        id: result.organization.id,
        organization_type: result.organization.organization_type,
        name: result.organization.name,
        registration_number: result.organization.registration_number,
        location: result.organization.location,
        contact_email: result.organization.contact_email,
        contact_phone: result.organization.contact_phone,
        verification_status: result.organization.verification_status,
        rejection_reason: result.organization.rejection_reason,
        is_active: result.organization.is_active,
        created_at: result.organization.created_at,
      },
      administrator: {
        id: result.administrator.id,
        user_id: result.user.id,
        full_name: result.administrator.full_name,
        email: result.user.email,
        phone: result.administrator.phone,
        roles: result.user.role,
      },
    };
  }

  private async createOrganizationAndAdministrator(
    organizationPayload: INormalizedOrganizationSetup,
    administratorPayload: INormalizedOrganizationAdministrator,
    parsedName: IParsedAdministratorName,
    hashedPassword: string,
  ): Promise<ICreatedOrganizationAdministrator> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const organizations = manager.withRepository(
          this.organizationRepository,
        );
        const administrators = manager.withRepository(
          this.administratorRepository,
        );
        const users = manager.withRepository(this.userRepository);

        if (
          await users.findOne({
            where: { email: administratorPayload.email },
          })
        ) {
          throw new ConflictException(
            sysMsg.ORGANIZATION_ADMIN_EMAIL_ALREADY_REGISTERED,
          );
        }

        if (
          await organizations.findOne({
            where: {
              registration_number: organizationPayload.registrationNumber,
            },
          })
        ) {
          throw new ConflictException(sysMsg.ORGANIZATION_ALREADY_EXISTS);
        }

        const organization = await organizations.save(
          organizations.create({
            organization_type: organizationPayload.organizationType,
            name: organizationPayload.name,
            registration_number: organizationPayload.registrationNumber,
            location: organizationPayload.location,
            contact_email: organizationPayload.contactEmail,
            contact_phone: organizationPayload.contactPhone,
            verification_status: OrganizationVerificationStatus.PENDING,
            rejection_reason: null,
            is_active: true,
          }),
        );
        const user = await users.save(
          users.create({
            email: administratorPayload.email,
            password: hashedPassword,
            first_name: parsedName.firstName,
            last_name: parsedName.lastName,
            middle_name: parsedName.middleName,
            phone: administratorPayload.phone,
            role: [ORGANIZATION_ADMIN_ROLE[organization.organization_type]],
            is_active: true,
            is_verified: true,
          }),
        );
        const administrator = await administrators.save(
          administrators.create({
            organization_id: organization.id,
            user_id: user.id,
            full_name: administratorPayload.fullName,
            phone: administratorPayload.phone,
            is_primary: true,
          }),
        );

        return { organization, user, administrator };
      });
    } catch (error: unknown) {
      if (error instanceof ConflictException) throw error;

      const databaseError = error as { code?: string; constraint?: string };
      if (
        databaseError.code === '23505' &&
        databaseError.constraint === 'UQ_users_email'
      ) {
        throw new ConflictException(
          sysMsg.ORGANIZATION_ADMIN_EMAIL_ALREADY_REGISTERED,
        );
      }
      if (databaseError.code === '23505') {
        throw new ConflictException(sysMsg.ORGANIZATION_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  private normalizeOrganization(
    dto: SetupOrganizationDto,
  ): INormalizedOrganizationSetup {
    if (!dto.organization) {
      throw new BadRequestException('organization is required');
    }
    if (
      !Object.values(OrganizationType).includes(
        dto.organization.organization_type,
      )
    ) {
      throw new BadRequestException('organization_type is invalid');
    }
    return {
      organizationType: dto.organization.organization_type,
      name: this.required(dto.organization.name, 'name'),
      registrationNumber: this.required(
        dto.organization.registration_number,
        'registration_number',
      ),
      location: this.required(dto.organization.location, 'location'),
      contactEmail: this.required(
        dto.organization.contact_email,
        'contact_email',
      ).toLowerCase(),
      contactPhone: dto.organization.contact_phone?.trim() || null,
    };
  }

  private normalizeAdministrator(
    dto: SetupOrganizationDto,
  ): INormalizedOrganizationAdministrator {
    if (!dto.administrator) {
      throw new BadRequestException('administrator is required');
    }
    return {
      fullName: this.required(dto.administrator.full_name, 'full_name').replace(
        /\s+/g,
        ' ',
      ),
      email: this.required(dto.administrator.email, 'email').toLowerCase(),
      phone: this.required(dto.administrator.phone, 'phone'),
      password: dto.administrator.password,
    };
  }

  private parseFullName(fullName: string): IParsedAdministratorName {
    const [firstName, ...remaining] = fullName.split(/\s+/);
    return {
      firstName,
      lastName: remaining.pop() ?? 'Administrator',
      middleName: remaining.join(' ') || null,
    };
  }

  private required(value: string, field: string): string {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(`${field} is required`);
    return normalized;
  }
}
