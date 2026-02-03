import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserRole } from '../../user/enums/user-role.enum';

interface IJwtPayload {
  sub: string;
  email: string;
  role: UserRole[] | UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change_me'),
    });
  }

  async validate(payload: IJwtPayload) {
    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      roles,
    };
  }
}
