import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProfessionalPatientNoteDto {
  @ApiProperty({
    example:
      'Patient reports recurring headaches in the evenings. Advised hydration and reduced screen time.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

export class UpdateProfessionalPatientNoteDto extends PartialType(
  CreateProfessionalPatientNoteDto,
) {}
