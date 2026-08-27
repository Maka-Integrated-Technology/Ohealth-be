import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../user/entities/user.entity';

import { LegalAcceptance } from './entities/legal-acceptance.entity';
import { UserPersona } from './entities/user-persona.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserPersona, LegalAcceptance])],
  exports: [TypeOrmModule],
})
export class IdentityModule {}
