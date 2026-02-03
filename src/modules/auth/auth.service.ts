import * as crypto from 'crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Logger } from 'winston';

import { IRequestWithUser } from '../../common/types';
import * as sysMsg from '../../constants/system.messages';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../user/enums/user-role.enum';
import { UserService } from '../user/user.service';

import {
  AuthDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { AuthSession } from './entities/auth.entity';

interface IRefreshPayload {
  sub: string;
  email: string;
  role: UserRole[] | UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger: Logger;
  private readonly saltRounds: number;

  constructor(
    private readonly userService: UserService,
    @InjectRepository(AuthSession)
    private readonly sessionRepository: Repository<AuthSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: AuthService.name });
    this.saltRounds = Number(this.configService.get<string>('HASH_SALT', '10'));
  }

  async signup(signupPayload: AuthDto) {
    const email = signupPayload.email.trim().toLowerCase();
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException(sysMsg.ACCOUNT_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(
      signupPayload.password,
      this.saltRounds,
    );
    const savedUser = await this.userService.create({
      email,
      password: hashedPassword,
      first_name: signupPayload.first_name.trim(),
      last_name: signupPayload.last_name.trim(),
      middle_name: signupPayload.middle_name?.trim() || null,
      gender: signupPayload.gender ?? null,
      dob: signupPayload.dob ?? null,
      phone: signupPayload.phone ?? null,
      role: signupPayload.role?.length
        ? signupPayload.role
        : [UserRole.PATIENT],
      is_active: signupPayload.is_active ?? true,
      is_verified: false,
    });
    const tokens = await this.generateTokens(
      savedUser.id,
      savedUser.email,
      savedUser.role,
    );
    const session = await this.createSession(
      savedUser.id,
      tokens.refresh_token,
    );

    this.logger.info(sysMsg.ACCOUNT_CREATED);

    return {
      message: sysMsg.ACCOUNT_CREATED,
      user: this.toUserResponse(savedUser),
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  async login(loginPayload: LoginDto) {
    const email = loginPayload.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }

    if (!user.is_active) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }

    const isPasswordValid = await bcrypt.compare(
      loginPayload.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const session = await this.createSession(user.id, tokens.refresh_token);

    this.logger.info(sysMsg.LOGIN_SUCCESS);

    return {
      message: sysMsg.LOGIN_SUCCESS,
      user: this.toUserResponse(user),
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  async refreshToken(refreshToken: RefreshTokenDto) {
    let payload: IRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<IRefreshPayload>(
        refreshToken.refresh_token,
        {
          secret: this.getRefreshSecret(),
        },
      );
    } catch {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const session = await this.sessionRepository.findOne({
      where: {
        user_id: payload.sub,
        refresh_token_hash: this.hashToken(refreshToken.refresh_token),
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
    });

    if (!session) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    const tokens = await this.generateTokens(payload.sub, payload.email, roles);

    session.revoked_at = new Date();
    await this.sessionRepository.save(session);
    const newSession = await this.createSession(
      payload.sub,
      tokens.refresh_token,
    );

    this.logger.info(sysMsg.TOKEN_REFRESH_SUCCESS);

    return {
      message: sysMsg.TOKEN_REFRESH_SUCCESS,
      ...tokens,
      session_id: newSession.session_id,
      session_expires_at: newSession.expires_at,
    };
  }

  async forgotPassword(
    payload: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const email = payload.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);

    if (user) {
      user.reset_token = crypto.randomBytes(32).toString('hex');
      user.reset_token_expiry = new Date(Date.now() + 60 * 60 * 1000);
      await this.userService.save(user);

      this.logger.info(`Password reset token generated for user ${user.id}`);
    }

    return {
      message: sysMsg.PASSWORD_RESET_TOKEN_SENT,
    };
  }

  async resetPassword(payload: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(payload.token);

    if (
      !user ||
      !user.reset_token_expiry ||
      user.reset_token_expiry < new Date()
    ) {
      throw new BadRequestException(sysMsg.TOKEN_INVALID);
    }

    user.password = await bcrypt.hash(payload.newPassword, this.saltRounds);
    user.reset_token = null;
    user.reset_token_expiry = null;
    await this.userService.save(user);

    await this.sessionRepository
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revoked_at: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('revoked_at IS NULL')
      .execute();

    return {
      message: sysMsg.PASSWORD_RESET_SUCCESS,
    };
  }

  async activateUserAccount(id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(sysMsg.USER_NOT_FOUND);
    }

    if (user.is_active) {
      return sysMsg.USER_IS_ACTIVATED;
    }

    user.is_active = true;
    await this.userService.save(user);
    return sysMsg.USER_ACTIVATED;
  }

  async getProfile(req: IRequestWithUser) {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      this.logger.warn(sysMsg.USER_NOT_FOUND);
      throw new UnauthorizedException(sysMsg.USER_NOT_FOUND);
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      role: user.role,
      gender: user.gender,
      dob: user.dob,
      phone: user.phone,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async logout(logoutPayload: LogoutDto) {
    const session = await this.sessionRepository.findOne({
      where: {
        session_id: logoutPayload.session_id,
        user_id: logoutPayload.user_id,
        revoked_at: IsNull(),
      },
    });

    if (session) {
      session.revoked_at = new Date();
      await this.sessionRepository.save(session);
    }

    this.logger.info(sysMsg.LOGOUT_SUCCESS);

    return {
      message: sysMsg.LOGOUT_SUCCESS,
    };
  }

  async googleLogin(token: string, inviteToken?: string) {
    void inviteToken;
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    let payload: {
      email?: string;
      sub?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    } | null;
    try {
      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    const email = payload.email.toLowerCase();
    let user = await this.userService.findByEmail(email);

    if (!user) {
      const generatedPassword = crypto.randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(
        generatedPassword,
        this.saltRounds,
      );

      user = await this.userService.create({
        email,
        password: hashedPassword,
        first_name: payload.given_name || 'HealthBridge',
        last_name: payload.family_name || 'User',
        middle_name: null,
        gender: null,
        dob: null,
        phone: null,
        role: [UserRole.PATIENT],
        is_active: true,
        is_verified: true,
        google_id: payload.sub,
      });
    } else if (!user.google_id) {
      user.google_id = payload.sub;
      user = await this.userService.save(user);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const session = await this.createSession(user.id, tokens.refresh_token);

    return {
      message: sysMsg.LOGIN_SUCCESS,
      user: {
        ...this.toUserResponse(user),
        picture: payload.picture,
      },
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    roles: UserRole[],
  ) {
    const payload = { sub: userId, email, role: roles };
    const accessExpiresIn = this.parseDurationToSeconds(
      this.configService.get<string>('TOKEN_ACCESS_DURATION', '15m'),
      900,
    );
    const refreshExpiresIn = this.parseDurationToSeconds(
      this.configService.get<string>('TOKEN_REFRESH_DURATION', '7d'),
      604800,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getAccessSecret(),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getRefreshSecret(),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async createSession(userId: string, refreshToken: string) {
    const session = this.sessionRepository.create({
      session_id: crypto.randomUUID(),
      user_id: userId,
      refresh_token_hash: this.hashToken(refreshToken),
      expires_at: this.getTokenExpiry(refreshToken),
      revoked_at: null,
    });
    return this.sessionRepository.save(session);
  }

  private toUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getTokenExpiry(token: string): Date {
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private getAccessSecret() {
    return this.configService.get<string>('JWT_SECRET', 'change_me');
  }

  private getRefreshSecret() {
    return this.configService.get<string>('JWT_REFRESH_SECRET', 'change_me');
  }

  private parseDurationToSeconds(
    value: string,
    fallbackSeconds: number,
  ): number {
    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }

    const match = normalized.match(/^(\d+)([smhd])$/i);
    if (!match) {
      return fallbackSeconds;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return amount * multipliers[unit];
  }
}
