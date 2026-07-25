import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import * as sysMsg from '../../../constants/system.messages';
import { UserRole } from '../../user/enums/user-role.enum';
import { UserService } from '../../user/user.service';
import { haveSameRoles } from '../utils/auth-role.util';

interface IJwtPayload {
  sub: string;
  email: string;
  role: UserRole[] | UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change_me'),
    });
  }

  async validate(payload: IJwtPayload) {
    const user = await this.userService.findById(payload.sub);
    if (!user || !user.is_active || !user.is_verified) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }

    if (!haveSameRoles(payload.role, user.role)) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      roles: user.role,
    };
  }
}
