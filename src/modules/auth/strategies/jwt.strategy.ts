import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { RefreshSessionService } from '../refresh-session.service';
import { sessionSettings } from '../session-settings';

interface IJwtPayload {
  sub?: string;
  sid?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly sessions: RefreshSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: sessionSettings(config).secret,
    });
  }

  async validate(payload: IJwtPayload) {
    if (
      ![payload.sub, payload.sid, payload.jti].every(
        (value) => typeof value === 'string' && UUID.test(value),
      )
    ) {
      throw new UnauthorizedException('Invalid session credential');
    }
    if (
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp! <= payload.iat! ||
      payload.exp! - payload.iat! > 900
    ) {
      throw new UnauthorizedException('Invalid session lifetime');
    }
    const user = await this.sessions.validate(payload.sub!, payload.sid!);
    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      roles: user.role,
      sessionId: payload.sid,
    };
  }
}
