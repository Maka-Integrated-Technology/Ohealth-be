import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  DayOfWeek,
  LaboratoryStaffRole,
  LaboratoryStaffStatus,
} from '../enums/laboratory-post-approval.enum';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class SetLaboratoryOperatingHourDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  day_of_week: DayOfWeek;

  @ApiProperty({ example: false })
  @IsBoolean()
  is_closed: boolean;

  @ApiProperty({
    example: '08:00',
    required: false,
    nullable: true,
    description: 'Required in HH:mm format when the laboratory is open',
  })
  @ValidateIf((dto: SetLaboratoryOperatingHourDto) => !dto.is_closed)
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN)
  opens_at?: string | null;

  @ApiProperty({
    example: '18:00',
    required: false,
    nullable: true,
    description: 'Required in HH:mm format when the laboratory is open',
  })
  @ValidateIf((dto: SetLaboratoryOperatingHourDto) => !dto.is_closed)
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN)
  closes_at?: string | null;
}

export class SetLaboratoryOperatingHoursDto {
  @ApiProperty({ type: [SetLaboratoryOperatingHourDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => SetLaboratoryOperatingHourDto)
  hours: SetLaboratoryOperatingHourDto[];
}

export class LaboratoryOperatingHourResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DayOfWeek })
  day_of_week: DayOfWeek;

  @ApiProperty({ nullable: true, example: '08:00' })
  opens_at: string | null;

  @ApiProperty({ nullable: true, example: '18:00' })
  closes_at: string | null;

  @ApiProperty()
  is_closed: boolean;

  @ApiProperty()
  updated_at: Date;
}

export class CreateLaboratoryTestDto {
  @ApiProperty({ example: 'Full Blood Count' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 15000, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  price: number;

  @ApiProperty({
    example: 1440,
    minimum: 1,
    maximum: 525600,
    description: 'Expected turnaround time in minutes',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(525600)
  turnaround_time_minutes: number;
}

export class UpdateLaboratoryTestDto extends PartialType(
  CreateLaboratoryTestDto,
) {
  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class LaboratoryTestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  turnaround_time_minutes: number;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class InviteLaboratoryStaffDto {
  @ApiProperty({ example: 'Amara Okafor' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  full_name: string;

  @ApiProperty({ example: 'amara@laboratory.example' })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: LaboratoryStaffRole,
    example: LaboratoryStaffRole.SCIENTIST,
  })
  @IsEnum(LaboratoryStaffRole)
  role: LaboratoryStaffRole;
}

export class AcceptLaboratoryStaffInvitationDto {
  @ApiProperty({ description: 'Invitation token from the email link' })
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  @MaxLength(128)
  token: string;

  @ApiProperty({ example: 'SecurePassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'password must contain an uppercase letter, lowercase letter, and number',
  })
  password: string;

  @ApiProperty({ required: false, example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class LaboratoryStaffResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  user_id: string | null;

  @ApiProperty()
  full_name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: LaboratoryStaffRole })
  role: LaboratoryStaffRole;

  @ApiProperty({ enum: LaboratoryStaffStatus })
  status: LaboratoryStaffStatus;

  @ApiProperty({ nullable: true })
  invitation_expires_at: Date | null;

  @ApiProperty({ nullable: true })
  accepted_at: Date | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class InviteLaboratoryStaffResponseDto {
  @ApiProperty({ example: 'laboratory staff invitation sent successfully' })
  message: string;

  @ApiProperty({ type: LaboratoryStaffResponseDto })
  staff: LaboratoryStaffResponseDto;
}

export class AcceptLaboratoryStaffInvitationResponseDto {
  @ApiProperty({ example: 'laboratory staff invitation accepted successfully' })
  message: string;

  @ApiProperty({ type: LaboratoryStaffResponseDto })
  staff: LaboratoryStaffResponseDto;
}
