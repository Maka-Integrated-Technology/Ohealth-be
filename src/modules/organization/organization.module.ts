import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VerificationDocumentFileValidator } from '../../common/validators/verification-document-file.validator';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { User } from '../user/entities/user.entity';

import { OrganizationAdmin } from './entities/organization-admin.entity';
import { OrganizationDocument } from './entities/organization-document.entity';
import { OrganizationStatusHistory } from './entities/organization-status-history.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationApprovedGuard } from './guards/organization-approved.guard';
import { OrganizationDocumentsService } from './organization-documents.service';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { OrganizationVerificationService } from './organization-verification.service';
import { OrganizationController } from './organization.controller';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    StorageModule,
    TypeOrmModule.forFeature([
      Organization,
      OrganizationAdmin,
      OrganizationDocument,
      OrganizationStatusHistory,
      User,
    ]),
  ],
  controllers: [OrganizationController],
  providers: [
    OrganizationOnboardingService,
    OrganizationDocumentsService,
    OrganizationVerificationService,
    VerificationDocumentFileValidator,
    OrganizationApprovedGuard,
  ],
  exports: [
    OrganizationOnboardingService,
    OrganizationVerificationService,
    OrganizationApprovedGuard,
  ],
})
export class OrganizationModule {}
