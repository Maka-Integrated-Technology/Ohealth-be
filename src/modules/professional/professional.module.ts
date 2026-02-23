import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfessionalAvailability } from './entities/professional-availability.entity';
import { Professional } from './entities/professional.entity';
import { ProfessionalController } from './professional.controller';
import { ProfessionalService } from './professional.service';

@Module({
  imports: [TypeOrmModule.forFeature([Professional, ProfessionalAvailability])],
  controllers: [ProfessionalController],
  providers: [ProfessionalService],
  exports: [ProfessionalService],
})
export class ProfessionalModule {}
