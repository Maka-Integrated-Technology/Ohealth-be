import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { User } from '../../user/entities/user.entity';
import { UserModule } from '../../user/user.module';
import { PatientProfile } from '../entities/patient-profile.entity';

import { CanonicalPatientProfileService } from './canonical-patient-profile.service';

/**
 * Internal module until the existing /auth/me route completes the reviewed
 * schema and client migration. No parallel public profile API is exposed.
 */
@Module({
  imports: [
    AuthModule,
    UserModule,
    TypeOrmModule.forFeature([User, PatientProfile]),
  ],
  providers: [CanonicalPatientProfileService],
  exports: [CanonicalPatientProfileService],
})
export class PatientPersonalProfileModule {}
