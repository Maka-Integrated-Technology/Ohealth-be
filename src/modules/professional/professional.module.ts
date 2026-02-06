import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Professional } from './entities/professional.entity';
import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { ProfessionalService } from './professional.service';
import { ProfessionalController } from './professional.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Professional, ProfessionalAvailability])],
  controllers: [ProfessionalController],
  providers: [ProfessionalService],
  exports: [ProfessionalService],
})
export class ProfessionalModule {}
