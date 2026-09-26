import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/enums/user-role.enum';

import { ProfessionalController } from './professional.controller';

describe('ProfessionalController access', () => {
  const reflector = new Reflector();

  it.each([
    ['getMyPatients', ProfessionalController.prototype.getMyPatients],
    [
      'getMyPatientProfile',
      ProfessionalController.prototype.getMyPatientProfile,
    ],
    [
      'getMyPatientConsultations',
      ProfessionalController.prototype.getMyPatientConsultations,
    ],
    ['getMyPatientNotes', ProfessionalController.prototype.getMyPatientNotes],
    ['getMyDashboard', ProfessionalController.prototype.getMyDashboard],
    [
      'createMyPatientNote',
      ProfessionalController.prototype.createMyPatientNote,
    ],
    [
      'updateMyPatientNote',
      ProfessionalController.prototype.updateMyPatientNote,
    ],
  ])('restricts %s to professional roles', (_name, handler) => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, handler);

    expect(roles).toEqual([
      UserRole.DOCTOR,
      UserRole.THERAPIST,
      UserRole.COUNSELLOR,
      UserRole.LAB_PROFESSIONAL,
    ]);
  });

  it('restricts review submission to patients', () => {
    const roles = reflector.get<UserRole[]>(
      ROLES_KEY,
      ProfessionalController.prototype.createReview,
    );

    expect(roles).toEqual([UserRole.PATIENT]);
  });
});
