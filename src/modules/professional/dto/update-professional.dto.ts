import { PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateProfessionalDto } from './create-professional.dto';

export class UpdateProfessionalDto extends PartialType(
  OmitType(CreateProfessionalDto, ['user_id', 'speciality_id'] as const),
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_available?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
