import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { User } from '../user/entities/user.entity';

import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { LaboratoryVerificationStatusHistory } from './entities/laboratory-verification-status-history.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryApprovedGuard } from './guards/laboratory-approved.guard';
import { LaboratoryAuthController } from './laboratory-auth.controller';
import { LaboratoryAuthService } from './laboratory-auth.service';
import { LaboratoryVerificationDocumentFileValidator } from './laboratory-verification-document-file.validator';
import { LaboratoryVerificationDocumentsController } from './laboratory-verification-documents.controller';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';
import { LaboratoryVerificationStatusController } from './laboratory-verification-status.controller';
import { LaboratoryVerificationStatusService } from './laboratory-verification-status.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    StorageModule,
    TypeOrmModule.forFeature([
      Laboratory,
      LaboratoryAdmin,
      LaboratoryVerificationDocument,
      LaboratoryVerificationStatusHistory,
      User,
    ]),
  ],
  controllers: [
    LaboratoryAuthController,
    LaboratoryVerificationDocumentsController,
    LaboratoryVerificationStatusController,
  ],
  providers: [
    LaboratoryAuthService,
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
