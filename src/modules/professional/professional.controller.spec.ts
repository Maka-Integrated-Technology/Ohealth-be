import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/enums/user-role.enum';

import { ProfessionalController } from './professional.controller';

describe('ProfessionalController access', () => {
  const reflector = new Reflector();

  it('restricts review submission to patients', () => {
    const roles = reflector.get<UserRole[]>(
      ROLES_KEY,
      ProfessionalController.prototype.createReview,
    );

    expect(roles).toEqual([UserRole.PATIENT]);
  });
});
