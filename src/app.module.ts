import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalExceptionFilter } from './common/exceptions/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggerModule } from './common/logger.module';
import configuration from './config/config';
import { LoggingInterceptor } from './middleware/logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { ChatModule } from './modules/chat/chat.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { ProfessionalModule } from './modules/professional/professional.module';
import { SpecialityModule } from './modules/speciality/speciality.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ssl = config.get<boolean>('database.ssl');

        return {
          type: 'postgres',
          url: config.get<string>('database.url'),
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USER'),
          password: String(config.get<string>('DB_PASS') || 'postgres'),
          database: config.get<string>('DB_NAME'),
          ssl: ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          migrationsRun: false,
          synchronize: false,
        };
      },
    }),
    AuthModule,
    SpecialityModule,
    ProfessionalModule,
    BookingModule,
    ChatModule,
    LaboratoryModule,
    OrganizationModule,
    PharmacyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggingInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
