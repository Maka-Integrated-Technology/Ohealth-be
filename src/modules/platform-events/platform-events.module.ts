import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutboxEvent } from './entities/outbox-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  exports: [TypeOrmModule],
})
export class PlatformEventsModule {}
