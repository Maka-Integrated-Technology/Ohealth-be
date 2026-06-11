import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSpecialityDto {
  @ApiProperty({ example: 'General Doctor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, example: 'General medical consultations' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, example: 'stethoscope.png' })
  @IsString()
  @IsOptional()
  icon?: string;
}
