import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PublicDiscoveryModule } from '../public-discovery/public-discovery.module';

import { Speciality } from './entities/speciality.entity';
import { PublicSpecialityController } from './public-speciality.controller';
import { SpecialityController } from './speciality.controller';
import { SpecialityService } from './speciality.service';

@Module({
  imports: [TypeOrmModule.forFeature([Speciality]), PublicDiscoveryModule],
  controllers: [SpecialityController, PublicSpecialityController],
  providers: [SpecialityService],
  exports: [SpecialityService],
})
export class SpecialityModule {}
