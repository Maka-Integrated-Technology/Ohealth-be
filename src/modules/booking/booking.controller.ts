import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { IRequestWithUser } from '../../common/types';

import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    type: BookingResponseDto,
  })
  async create(
    @CurrentUser() user: IRequestWithUser['user'],
    @Body() createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingService.create(user.id, createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings for current user' })
  @ApiResponse({
    status: 200,
    description: 'List of bookings',
    type: [BookingResponseDto],
  })
  async findAll(@CurrentUser() user: IRequestWithUser['user']): Promise<BookingResponseDto[]> {
    return this.bookingService.findUserBookings(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking details',
    type: BookingResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: IRequestWithUser['user'],
  ): Promise<BookingResponseDto> {
    return this.bookingService.findOne(id, user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully',
    type: BookingResponseDto,
  })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: IRequestWithUser['user'],
  ): Promise<BookingResponseDto> {
    return this.bookingService.cancelBooking(id, user.id);
  }
}
