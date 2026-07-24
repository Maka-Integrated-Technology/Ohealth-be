import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationModule } from '../organization/organization.module';
import { StorageModule } from '../storage/storage.module';
import { User } from '../user/entities/user.entity';

import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryOperatingHour } from './entities/laboratory-operating-hour.entity';
import { LaboratoryStaff } from './entities/laboratory-staff.entity';
import { LaboratoryTest } from './entities/laboratory-test.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { LaboratoryVerificationStatusHistory } from './entities/laboratory-verification-status-history.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryApprovedGuard } from './guards/laboratory-approved.guard';
import { LaboratoryAuthController } from './laboratory-auth.controller';
import { LaboratoryAuthService } from './laboratory-auth.service';
import { LaboratoryPostApprovalController } from './laboratory-post-approval.controller';
import { LaboratoryPostApprovalService } from './laboratory-post-approval.service';
import { LaboratoryVerificationDocumentFileValidator } from './laboratory-verification-document-file.validator';
import { LaboratoryVerificationDocumentsController } from './laboratory-verification-documents.controller';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';
import { LaboratoryVerificationStatusController } from './laboratory-verification-status.controller';
import { LaboratoryVerificationStatusService } from './laboratory-verification-status.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    EmailModule,
    OrganizationModule,
    StorageModule,
    TypeOrmModule.forFeature([
      Laboratory,
      LaboratoryAdmin,
      LaboratoryOperatingHour,
      LaboratoryTest,
      LaboratoryStaff,
      LaboratoryVerificationDocument,
      LaboratoryVerificationStatusHistory,
      Organization,
      OrganizationAdmin,
      User,
    ]),
  ],
  controllers: [
    LaboratoryAuthController,
    LaboratoryPostApprovalController,
    LaboratoryVerificationDocumentsController,
    LaboratoryVerificationStatusController,
  ],
  providers: [
    LaboratoryAuthService,
    LaboratoryPostApprovalService,
    LaboratoryVerificationDocumentFileValidator,
    LaboratoryVerificationDocumentsService,
    LaboratoryVerificationStatusService,
    LaboratoryApprovedGuard,
  ],
  exports: [
    LaboratoryAuthService,
    LaboratoryVerificationDocumentsService,
    LaboratoryVerificationStatusService,
    LaboratoryApprovedGuard,
  ],
})
export class LaboratoryModule {}
