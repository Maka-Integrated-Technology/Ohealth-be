import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../booking/entities/booking.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { SpecialityModule } from '../speciality/speciality.module';
import { User } from '../user/entities/user.entity';

import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalPatientNote } from './entities/professional-patient-note.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import { Professional } from './entities/professional.entity';
import { ProfessionalController } from './professional.controller';
import { ProfessionalService } from './professional.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Professional,
      ProfessionalAvailability,
      ProfessionalReview,
      User,
      Booking,
      PatientProfile,
      ProfessionalPatientNote,
    ]),
    SpecialityModule,
  ],
  controllers: [ProfessionalController],
  providers: [ProfessionalService],
  exports: [ProfessionalService],
})
export class ProfessionalModule {}
