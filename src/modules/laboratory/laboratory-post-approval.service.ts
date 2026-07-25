import { createHash, randomBytes } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Logger } from 'winston';

import { EmailTemplateID } from '../../constants/email-constants';
import * as sysMsg from '../../constants/system.messages';
import { EmailService } from '../email/email.service';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationType } from '../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../organization/enums/organization-verification-status.enum';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';

import {
  AcceptLaboratoryStaffInvitationDto,
  AcceptLaboratoryStaffInvitationResponseDto,
  CreateLaboratoryTestDto,
  InviteLaboratoryStaffDto,
  InviteLaboratoryStaffResponseDto,
  LaboratoryOperatingHourResponseDto,
  LaboratoryStaffResponseDto,
  LaboratoryTestResponseDto,
  SetLaboratoryOperatingHourDto,
  SetLaboratoryOperatingHoursDto,
  UpdateLaboratoryTestDto,
} from './dto/laboratory-post-approval.dto';
import { LaboratoryOperatingHour } from './entities/laboratory-operating-hour.entity';
import { LaboratoryStaff } from './entities/laboratory-staff.entity';
import { LaboratoryTest } from './entities/laboratory-test.entity';
import {
  DAY_OF_WEEK_ORDER,
  DayOfWeek,
  LaboratoryStaffRole,
  LaboratoryStaffStatus,
} from './enums/laboratory-post-approval.enum';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class LaboratoryPostApprovalService {
  private readonly logger: Logger;
  private readonly saltRounds: number;

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationAdmin)
    private readonly administratorRepository: Repository<OrganizationAdmin>,
    @InjectRepository(LaboratoryOperatingHour)
    private readonly operatingHourRepository: Repository<LaboratoryOperatingHour>,
    @InjectRepository(LaboratoryTest)
    private readonly laboratoryTestRepository: Repository<LaboratoryTest>,
    @InjectRepository(LaboratoryStaff)
    private readonly laboratoryStaffRepository: Repository<LaboratoryStaff>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @Inject(WINSTON_MODULE_PROVIDER) baseLogger: Logger,
  ) {
    this.logger = baseLogger.child({
      context: LaboratoryPostApprovalService.name,
    });
    this.saltRounds = Number(this.configService.get<string>('HASH_SALT', '10'));
  }

  async setOperatingHours(
    userId: string,
    dto: SetLaboratoryOperatingHoursDto,
  ): Promise<LaboratoryOperatingHourResponseDto[]> {
    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    this.assertOperatingHours(dto.hours);

    const saved = await this.dataSource.transaction(async (manager) => {
      const organizations = manager.withRepository(this.organizationRepository);
      const hours = manager.withRepository(this.operatingHourRepository);
      await this.findLockedApprovedLaboratoryOrThrow(
        organizations,
        organization.id,
      );

      const records: LaboratoryOperatingHour[] = [];
      for (const schedule of dto.hours) {
        const existing = await hours.findOne({
          where: {
            organization_id: organization.id,
            day_of_week: schedule.day_of_week,
          },
        });
        records.push(
          hours.create({
            ...existing,
            organization_id: organization.id,
            day_of_week: schedule.day_of_week,
            is_closed: schedule.is_closed,
            opens_at: schedule.is_closed
              ? null
              : this.normalizeTime(schedule.opens_at!),
            closes_at: schedule.is_closed
              ? null
              : this.normalizeTime(schedule.closes_at!),
          }),
        );
      }
      return hours.save(records);
    });

    return this.sortOperatingHours(saved).map((entry) =>
      this.toOperatingHourDto(entry),
    );
  }

  async listOperatingHours(
    userId: string,
  ): Promise<LaboratoryOperatingHourResponseDto[]> {
    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    const hours = await this.operatingHourRepository.find({
      where: { organization_id: organization.id },
    });
    return this.sortOperatingHours(hours).map((entry) =>
      this.toOperatingHourDto(entry),
    );
  }

  async createTest(
    userId: string,
    dto: CreateLaboratoryTestDto,
  ): Promise<LaboratoryTestResponseDto> {
    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    const name = this.normalizeDisplayValue(dto.name);
    if (!name) {
      throw new BadRequestException(sysMsg.LABORATORY_TEST_NAME_REQUIRED);
    }
    const normalizedName = this.normalizeLookupValue(name);
    if (
      await this.laboratoryTestRepository.findOne({
        where: {
          organization_id: organization.id,
          normalized_name: normalizedName,
        },
      })
    ) {
      throw new ConflictException(sysMsg.LABORATORY_TEST_ALREADY_EXISTS);
    }

    try {
      const saved = await this.laboratoryTestRepository.save(
        this.laboratoryTestRepository.create({
          organization_id: organization.id,
          name,
          normalized_name: normalizedName,
          price: dto.price,
          turnaround_time_minutes: dto.turnaround_time_minutes,
          is_active: true,
        }),
      );
      return this.toLaboratoryTestDto(saved);
    } catch (error) {
      this.rethrowLaboratoryTestConflict(error);
    }
  }

  async listTests(userId: string): Promise<LaboratoryTestResponseDto[]> {
    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    const tests = await this.laboratoryTestRepository.find({
      where: { organization_id: organization.id },
      order: { name: 'ASC' },
    });
    return tests.map((test) => this.toLaboratoryTestDto(test));
  }

  async updateTest(
    userId: string,
    testId: string,
    dto: UpdateLaboratoryTestDto,
  ): Promise<LaboratoryTestResponseDto> {
    if (
      dto.name === undefined &&
      dto.price === undefined &&
      dto.turnaround_time_minutes === undefined &&
      dto.is_active === undefined
    ) {
      throw new BadRequestException(sysMsg.LABORATORY_TEST_UPDATE_REQUIRED);
    }

    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    const test = await this.laboratoryTestRepository.findOne({
      where: { id: testId, organization_id: organization.id },
    });
    if (!test) {
      throw new NotFoundException(sysMsg.LABORATORY_TEST_NOT_FOUND);
    }

    if (dto.name !== undefined) {
      const name = this.normalizeDisplayValue(dto.name);
      if (!name) {
        throw new BadRequestException(sysMsg.LABORATORY_TEST_NAME_REQUIRED);
      }
      const normalizedName = this.normalizeLookupValue(name);
      const duplicate = await this.laboratoryTestRepository.findOne({
        where: {
          organization_id: organization.id,
          normalized_name: normalizedName,
        },
      });
      if (duplicate && duplicate.id !== test.id) {
        throw new ConflictException(sysMsg.LABORATORY_TEST_ALREADY_EXISTS);
      }
      test.name = name;
      test.normalized_name = normalizedName;
    }
    if (dto.price !== undefined) test.price = dto.price;
    if (dto.turnaround_time_minutes !== undefined) {
      test.turnaround_time_minutes = dto.turnaround_time_minutes;
    }
    if (dto.is_active !== undefined) test.is_active = dto.is_active;

    try {
      return this.toLaboratoryTestDto(
        await this.laboratoryTestRepository.save(test),
      );
    } catch (error) {
      this.rethrowLaboratoryTestConflict(error);
    }
  }

  async inviteStaff(
    userId: string,
    dto: InviteLaboratoryStaffDto,
  ): Promise<InviteLaboratoryStaffResponseDto> {
    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    const email = dto.email.trim().toLowerCase();
    const fullName = this.normalizeDisplayValue(dto.full_name);
    if (!fullName) {
      throw new BadRequestException(sysMsg.LABORATORY_STAFF_NAME_REQUIRED);
    }
    if (!Object.values(LaboratoryStaffRole).includes(dto.role)) {
      throw new BadRequestException('invalid laboratory staff role');
    }
    if (await this.userRepository.findOne({ where: { email } })) {
      throw new ConflictException(sysMsg.LABORATORY_STAFF_ALREADY_EXISTS);
    }

    const existing = await this.laboratoryStaffRepository.findOne({
      where: { organization_id: organization.id, email },
    });
    if (existing?.status === LaboratoryStaffStatus.ACTIVE) {
      throw new ConflictException(sysMsg.LABORATORY_STAFF_ALREADY_EXISTS);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.getInvitationExpirationDays() * 24 * 60 * 60 * 1000,
    );
    const invitation = this.laboratoryStaffRepository.create({
      ...existing,
      organization_id: organization.id,
      user_id: null,
      invited_by_user_id: userId,
      full_name: fullName,
      email,
      role: dto.role,
      status: LaboratoryStaffStatus.INVITED,
      invitation_token_hash: this.hashInvitationToken(token),
      invitation_expires_at: expiresAt,
      accepted_at: null,
    });

    let saved: LaboratoryStaff;
    try {
      saved = await this.laboratoryStaffRepository.save(invitation);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(sysMsg.LABORATORY_STAFF_ALREADY_EXISTS);
      }
      throw error;
    }

    await this.sendStaffInvitationEmail(organization, saved, token);
    return {
      message: sysMsg.LABORATORY_STAFF_INVITED,
      staff: this.toLaboratoryStaffDto(saved),
    };
  }

  async listStaff(userId: string): Promise<LaboratoryStaffResponseDto[]> {
    const organization =
      await this.findApprovedLaboratoryForAdministrator(userId);
    const staff = await this.laboratoryStaffRepository.find({
      where: { organization_id: organization.id },
      order: { full_name: 'ASC' },
    });
    return staff.map((member) => this.toLaboratoryStaffDto(member));
  }

  async acceptStaffInvitation(
    dto: AcceptLaboratoryStaffInvitationDto,
  ): Promise<AcceptLaboratoryStaffInvitationResponseDto> {
    const tokenHash = this.hashInvitationToken(dto.token.trim());
    const initial = await this.laboratoryStaffRepository.findOne({
      where: { invitation_token_hash: tokenHash },
    });
    this.assertUsableInvitation(initial);
    const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

    let saved: LaboratoryStaff;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const organizations = manager.withRepository(
          this.organizationRepository,
        );
        const staff = manager.withRepository(this.laboratoryStaffRepository);
        const users = manager.withRepository(this.userRepository);
        const invitation = await staff.findOne({
          where: { invitation_token_hash: tokenHash },
          lock: { mode: 'pessimistic_write' },
        });
        this.assertUsableInvitation(invitation);
        await this.findLockedApprovedLaboratoryOrThrow(
          organizations,
          invitation!.organization_id,
        );

        if (await users.findOne({ where: { email: invitation!.email } })) {
          throw new ConflictException(sysMsg.LABORATORY_STAFF_ALREADY_EXISTS);
        }

        const [firstName, lastName, middleName] = this.parseFullName(
          invitation!.full_name,
        );
        const user = await users.save(
          users.create({
            email: invitation!.email,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName,
            phone: dto.phone?.trim() || null,
            role: [UserRole.LAB_STAFF],
            is_active: true,
            is_verified: true,
          }),
        );

        invitation!.user_id = user.id;
        invitation!.status = LaboratoryStaffStatus.ACTIVE;
        invitation!.invitation_token_hash = null;
        invitation!.invitation_expires_at = null;
        invitation!.accepted_at = new Date();
        return staff.save(invitation!);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(sysMsg.LABORATORY_STAFF_ALREADY_EXISTS);
      }
      throw error;
    }

    return {
      message: sysMsg.LABORATORY_STAFF_INVITATION_ACCEPTED,
      staff: this.toLaboratoryStaffDto(saved),
    };
  }

  private async findApprovedLaboratoryForAdministrator(
    userId: string,
  ): Promise<Organization> {
    const administrator = await this.administratorRepository.findOne({
      where: { user_id: userId },
      relations: { organization: true },
    });
    const organization = administrator?.organization;
    this.assertApprovedLaboratory(organization);
    return organization!;
  }

  private async findLockedApprovedLaboratoryOrThrow(
    repository: Repository<Organization>,
    organizationId: string,
  ): Promise<Organization> {
    const organization = await repository.findOne({
      where: { id: organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    this.assertApprovedLaboratory(organization);
    return organization!;
  }

  private assertApprovedLaboratory(organization?: Organization | null): void {
    if (
      !organization ||
      organization.organization_type !== OrganizationType.LABORATORY ||
      !organization.is_active ||
      organization.verification_status !==
        OrganizationVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException(sysMsg.LABORATORY_APPROVED_ADMIN_REQUIRED);
    }
  }

  private assertOperatingHours(
    schedules: SetLaboratoryOperatingHourDto[],
  ): void {
    const validDays = new Set(Object.values(DayOfWeek));
    if (schedules.some((schedule) => !validDays.has(schedule.day_of_week))) {
      throw new BadRequestException(sysMsg.LABORATORY_OPERATING_HOURS_INVALID);
    }
    if (
      new Set(schedules.map((schedule) => schedule.day_of_week)).size !==
      schedules.length
    ) {
      throw new BadRequestException(
        sysMsg.LABORATORY_OPERATING_HOURS_DUPLICATE_DAY,
      );
    }
    for (const schedule of schedules) {
      const hasOpeningTime = Boolean(schedule.opens_at);
      const hasClosingTime = Boolean(schedule.closes_at);
      if (
        (schedule.is_closed && (hasOpeningTime || hasClosingTime)) ||
        (!schedule.is_closed &&
          (!hasOpeningTime ||
            !hasClosingTime ||
            !TIME_PATTERN.test(schedule.opens_at!) ||
            !TIME_PATTERN.test(schedule.closes_at!) ||
            schedule.opens_at! >= schedule.closes_at!))
      ) {
        throw new BadRequestException(
          sysMsg.LABORATORY_OPERATING_HOURS_INVALID,
        );
      }
    }
  }

  private assertUsableInvitation(invitation?: LaboratoryStaff | null): void {
    if (
      !invitation ||
      invitation.status !== LaboratoryStaffStatus.INVITED ||
      !invitation.invitation_token_hash ||
      !invitation.invitation_expires_at ||
      invitation.invitation_expires_at.getTime() <= Date.now()
    ) {
      throw new BadRequestException(sysMsg.LABORATORY_STAFF_INVITATION_INVALID);
    }
  }

  private async sendStaffInvitationEmail(
    organization: Organization,
    invitation: LaboratoryStaff,
    token: string,
  ): Promise<void> {
    const fromAddress = this.configService.get<string>('mail.from.address');
    const fromName = this.configService.get<string>('mail.from.name');
    const frontendUrl = this.configService.get<string>('frontend.url');
    if (!fromAddress || !frontendUrl) {
      this.logger.error(
        'Laboratory staff invitation email cannot be sent: mail sender or frontend URL is not configured',
        { staff_id: invitation.id },
      );
      throw new ServiceUnavailableException(
        sysMsg.LABORATORY_STAFF_INVITATION_SEND_FAILED,
      );
    }

    const invitationUrl = `${frontendUrl.replace(/\/$/, '')}/laboratory/staff/invitations/accept?token=${encodeURIComponent(token)}`;
    try {
      await this.emailService.sendMail({
        from: { email: fromAddress, name: fromName },
        to: [{ email: invitation.email, name: invitation.full_name }],
        subject: `Invitation to join ${organization.name} on OHealth`,
        templateNameID: EmailTemplateID.LABORATORY_STAFF_INVITATION,
        templateData: {
          name: invitation.full_name,
          laboratory_name: organization.name,
          staff_role: invitation.role,
          invitation_url: invitationUrl,
          expiry_days: this.getInvitationExpirationDays(),
        },
      });
      this.logger.info('Laboratory staff invitation email sent', {
        staff_id: invitation.id,
        organization_id: organization.id,
      });
    } catch (error) {
      this.logger.error('Failed to send laboratory staff invitation email', {
        error,
        staff_id: invitation.id,
        organization_id: organization.id,
      });
      throw new ServiceUnavailableException(
        sysMsg.LABORATORY_STAFF_INVITATION_SEND_FAILED,
      );
    }
  }

  private getInvitationExpirationDays(): number {
    const configured = Number(
      this.configService.get<number>('invite.expirationDays', 7),
    );
    return Number.isInteger(configured) && configured > 0 && configured <= 30
      ? configured
      : 7;
  }

  private parseFullName(
    fullName: string,
  ): [firstName: string, lastName: string, middleName: string | null] {
    const parts = fullName.split(' ');
    const firstName = parts.shift()!;
    const lastName = parts.length ? parts.pop()! : 'Staff';
    return [firstName, lastName, parts.join(' ') || null];
  }

  private sortOperatingHours(
    hours: LaboratoryOperatingHour[],
  ): LaboratoryOperatingHour[] {
    return [...hours].sort(
      (left, right) =>
        DAY_OF_WEEK_ORDER[left.day_of_week] -
        DAY_OF_WEEK_ORDER[right.day_of_week],
    );
  }

  private toOperatingHourDto(
    hour: LaboratoryOperatingHour,
  ): LaboratoryOperatingHourResponseDto {
    return {
      id: hour.id,
      day_of_week: hour.day_of_week,
      opens_at: hour.opens_at?.slice(0, 5) ?? null,
      closes_at: hour.closes_at?.slice(0, 5) ?? null,
      is_closed: hour.is_closed,
      updated_at: hour.updated_at,
    };
  }

  private toLaboratoryTestDto(test: LaboratoryTest): LaboratoryTestResponseDto {
    return {
      id: test.id,
      name: test.name,
      price: Number(test.price),
      turnaround_time_minutes: test.turnaround_time_minutes,
      is_active: test.is_active,
      created_at: test.created_at,
      updated_at: test.updated_at,
    };
  }

  private toLaboratoryStaffDto(
    staff: LaboratoryStaff,
  ): LaboratoryStaffResponseDto {
    return {
      id: staff.id,
      user_id: staff.user_id,
      full_name: staff.full_name,
      email: staff.email,
      role: staff.role,
      status: staff.status,
      invitation_expires_at: staff.invitation_expires_at,
      accepted_at: staff.accepted_at,
      created_at: staff.created_at,
      updated_at: staff.updated_at,
    };
  }

  private normalizeTime(value: string): string {
    return `${value}:00`;
  }

  private normalizeDisplayValue(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeLookupValue(value: string): string {
    return this.normalizeDisplayValue(value).toLowerCase();
  }

  private hashInvitationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private rethrowLaboratoryTestConflict(error: unknown): never {
    if (this.isUniqueViolation(error)) {
      throw new ConflictException(sysMsg.LABORATORY_TEST_ALREADY_EXISTS);
    }
    throw error;
  }

  private isUniqueViolation(error: unknown): boolean {
    const queryError = error as QueryFailedError & {
      driverError?: { code?: string };
    };
    return (
      error instanceof QueryFailedError &&
      queryError.driverError?.code === '23505'
    );
  }
}
