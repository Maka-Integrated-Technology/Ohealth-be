import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../booking/entities/booking.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { SpecialityModule } from '../speciality/speciality.module';
import { StorageModule } from '../storage/storage.module';
import { User } from '../user/entities/user.entity';

import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalPatientNote } from './entities/professional-patient-note.entity';
import { ProfessionalReview } from './entities/professional-review.entity';
import { ProfessionalVerificationDocument } from './entities/professional-verification-document.entity';
import { ProfessionalVerificationStatusHistory } from './entities/professional-verification-status-history.entity';
import { Professional } from './entities/professional.entity';
import { ProfessionalVerificationDocumentFileValidator } from './professional-verification-document-file.validator';
import { ProfessionalVerificationDocumentsController } from './professional-verification-documents.controller';
import { ProfessionalVerificationDocumentsService } from './professional-verification-documents.service';
import { ProfessionalVerificationStatusController } from './professional-verification-status.controller';
import { ProfessionalVerificationStatusService } from './professional-verification-status.service';
import { ProfessionalController } from './professional.controller';
import { ProfessionalService } from './professional.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Professional,
      ProfessionalAvailability,
      ProfessionalReview,
      ProfessionalVerificationDocument,
      ProfessionalVerificationStatusHistory,
      User,
      Booking,
      PatientProfile,
      ProfessionalPatientNote,
    ]),
    SpecialityModule,
    StorageModule,
  ],
  controllers: [
    ProfessionalController,
    ProfessionalVerificationDocumentsController,
    ProfessionalVerificationStatusController,
  ],
  providers: [
    ProfessionalService,
    ProfessionalVerificationDocumentFileValidator,
    ProfessionalVerificationDocumentsService,
    ProfessionalVerificationStatusService,
  ],
  exports: [ProfessionalService],
})
export class ProfessionalModule {}
