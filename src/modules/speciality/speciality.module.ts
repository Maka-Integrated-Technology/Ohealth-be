import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Speciality } from './entities/speciality.entity';
import { SpecialityService } from './speciality.service';
import { SpecialityController } from './speciality.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Speciality])],
  controllers: [SpecialityController],
  providers: [SpecialityService],
  exports: [SpecialityService],
})
export class SpecialityModule {}
