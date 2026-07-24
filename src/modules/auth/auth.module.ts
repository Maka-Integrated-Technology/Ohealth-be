import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../email/email.module';
import { LaboratoryAdmin } from '../laboratory/entities/laboratory-admin.entity';
import { OrganizationAdmin } from '../organization/entities/organization-admin.entity';
import { Professional } from '../professional/entities/professional.entity';
import { UserModule } from '../user/user.module';

import { AuthRoutingService } from './auth-routing.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSession } from './entities/auth.entity';
import { User2fa } from './entities/user-2fa.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      AuthSession,
      User2fa,
      Professional,
      OrganizationAdmin,
      LaboratoryAdmin,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me'),
      }),
    }),
  ],
  controllers: [AuthController, TwoFactorAuthController],
  providers: [
    AuthService,
    AuthRoutingService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TwoFactorAuthService,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
