import { PickType } from '@nestjs/swagger';

import { UpdatePatientPersonalProfileDto } from '../../patient/personal-profile/patient-personal-profile.dto';

/** Person-wide fields shared with the patient contract; address is patient-owned. */
export class UpdateProfessionalPersonalProfileDto extends PickType(
  UpdatePatientPersonalProfileDto,
  [
    'first_name',
    'last_name',
    'middle_name',
    'gender',
    'dob',
    'country',
  ] as const,
) {}
