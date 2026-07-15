import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { User } from '../user/entities/user.entity';

import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { LaboratoryVerificationDocument } from './entities/laboratory-verification-document.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryAuthController } from './laboratory-auth.controller';
import { LaboratoryAuthService } from './laboratory-auth.service';
import { LaboratoryVerificationDocumentFileValidator } from './laboratory-verification-document-file.validator';
import { LaboratoryVerificationDocumentsController } from './laboratory-verification-documents.controller';
import { LaboratoryVerificationDocumentsService } from './laboratory-verification-documents.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    StorageModule,
    TypeOrmModule.forFeature([
      Laboratory,
      LaboratoryAdmin,
      LaboratoryVerificationDocument,
      User,
    ]),
  ],
  controllers: [
    LaboratoryAuthController,
    LaboratoryVerificationDocumentsController,
  ],
  providers: [
    LaboratoryAuthService,
    LaboratoryVerificationDocumentFileValidator,
    LaboratoryVerificationDocumentsService,
  ],
  exports: [LaboratoryAuthService, LaboratoryVerificationDocumentsService],
})
export class LaboratoryModule {}
