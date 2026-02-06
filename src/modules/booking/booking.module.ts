import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from './entities/booking.entity';
import { Professional } from '../professional/entities/professional.entity';
import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Professional, ProfessionalAvailability])],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
