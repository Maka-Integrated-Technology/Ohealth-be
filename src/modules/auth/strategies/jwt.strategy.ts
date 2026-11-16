import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import * as sysMsg from '../../../constants/system.messages';
import { RefreshSessionService } from '../sessions/refresh-session.service';
import { sessionSettings } from '../sessions/session-settings';

interface IJwtPayload {
  sub: string;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessions: RefreshSessionService,
  ) {
    const settings = sessionSettings(configService);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: settings.jwtSecret,
    });
  }

  async validate(payload: IJwtPayload) {
    if (
      !UUID.test(payload.sub) ||
      !UUID.test(payload.sid) ||
      !UUID.test(payload.jti) ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > 900
    ) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const user = await this.sessions.validate(payload.sub, payload.sid);

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      sessionId: payload.sid,
    };
  }
}
