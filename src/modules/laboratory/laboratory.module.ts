import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from '../user/entities/user.entity';

import { LaboratoryAdmin } from './entities/laboratory-admin.entity';
import { Laboratory } from './entities/laboratory.entity';
import { LaboratoryAuthController } from './laboratory-auth.controller';
import { LaboratoryAuthService } from './laboratory-auth.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([Laboratory, LaboratoryAdmin, User]),
  ],
  controllers: [LaboratoryAuthController],
  providers: [LaboratoryAuthService],
  exports: [LaboratoryAuthService],
})
export class LaboratoryModule {}
