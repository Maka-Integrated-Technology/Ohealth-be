import { Reflector } from '@nestjs/core';

import { AuthCapability } from '../auth/context/auth-capability';
import { AUTH_CAPABILITIES_KEY } from '../auth/decorators/capabilities.decorator';

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
    const capabilities = reflector.get<AuthCapability[]>(
      AUTH_CAPABILITIES_KEY,
      handler,
    );

    expect(capabilities).toEqual([
      _name === 'getMyDashboard'
        ? AuthCapability.PROFESSIONAL_OPERATIONAL
        : AuthCapability.PROFESSIONAL_PATIENT_CARE,
    ]);
  });

  it('restricts review submission to patients', () => {
    const capabilities = reflector.get<AuthCapability[]>(
      AUTH_CAPABILITIES_KEY,
      ProfessionalController.prototype.createReview,
    );

    expect(capabilities).toEqual([AuthCapability.PATIENT_REVIEW_PROFESSIONAL]);
  });
});
