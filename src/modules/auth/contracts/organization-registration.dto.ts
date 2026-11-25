import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class OrganizationRegistrationDto {
  @ApiProperty({ example: 'Example Organization' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'EXAMPLE-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  registration_number: string;

  @ApiProperty({ example: 'Example location' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location: string;

  @ApiProperty({ format: 'email', example: 'operations@example.com' })
  @IsEmail()
  contact_email: string;

  @ApiPropertyOptional({ example: '+10000000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contact_phone?: string;
}
