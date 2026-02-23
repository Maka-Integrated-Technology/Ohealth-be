import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfessionalAvailability } from '../professional/entities/professional-availability.entity';
import { Professional } from '../professional/entities/professional.entity';

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Professional, ProfessionalAvailability]),
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
