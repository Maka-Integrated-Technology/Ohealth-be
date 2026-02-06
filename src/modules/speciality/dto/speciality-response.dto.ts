import { ApiProperty } from '@nestjs/swagger';

export class SpecialityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  icon?: string;

  @ApiProperty()
  is_active: boolean;
}
