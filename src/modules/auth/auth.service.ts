import * as crypto from 'crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { Logger } from 'winston';

import { IRequestWithUser } from '../../common/types';
import { EmailTemplateID } from '../../constants/email-constants';
import * as sysMsg from '../../constants/system.messages';
import { EmailService } from '../email/email.service';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { UserService } from '../user/user.service';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { AuthRoutingService } from './auth-routing.service';
import { AuthChallengeDeliveryService } from './challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from './challenges/auth-challenge.entity';
import { SecureAuthChallengeFlowsService } from './challenges/secure-auth-challenge-flows.service';
import { SELF_SERVICE_SIGNUP_ROLES } from './constants/self-service-signup-roles.constant';
import {
  AuthDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifySignupDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { AuthSession } from './entities/auth.entity';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { isLoginPasswordWithinLimit } from './password-policy/password-policy';
import { haveSameRoles } from './utils/auth-role.util';

interface IRefreshPayload {
  sub: string;
  email: string;
  role: UserRole[] | UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger: Logger;

  constructor(
    private readonly userService: UserService,
    @InjectRepository(AuthSession)
    private readonly sessionRepository: Repository<AuthSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly authRoutingService: AuthRoutingService,
    private readonly accountAccessPolicy: AccountAccessPolicyService,
    private readonly passwordCredentials: PasswordCredentialsService,
    private readonly challengeFlows: SecureAuthChallengeFlowsService,
    private readonly challengeDelivery: AuthChallengeDeliveryService,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: AuthService.name });
  }

  async signup(signupPayload: AuthDto) {
    if (
      !Array.isArray(signupPayload.role) ||
      signupPayload.role.length !== 1 ||
      !SELF_SERVICE_SIGNUP_ROLES.includes(signupPayload.role[0])
    ) {
      throw new BadRequestException(sysMsg.INVALID_SIGNUP_ROLE);
    }
    const hashedPassword = await this.passwordCredentials.hashNewPassword(
      signupPayload.password,
    );
    const { user, challengeId } = await this.challengeFlows.signup(
      signupPayload,
      hashedPassword,
    );
    const routing = await this.authRoutingService.resolve(user);
    this.logger.info(sysMsg.ACCOUNT_CREATED);
    return {
      message: 'Verification queued',
      challenge_id: challengeId,
      user: this.toUserResponse(user),
      ...routing,
    };
  }

  async login(loginPayload: LoginDto) {
    // Reject pathological passwords before querying account existence.
    if (!isLoginPasswordWithinLimit(loginPayload.password)) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }
    const email = loginPayload.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);

    // Unknown and incorrect credentials take the same bcrypt comparison path.
    // No account-state check happens until after the password is proven.
    const isPasswordValid = await this.passwordCredentials.verifyForLogin(
      loginPayload.password,
      user?.password ?? null,
    );
    if (!user || !isPasswordValid) {
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }
    this.accountAccessPolicy.assertCanAuthenticate(user);

    const [tokens, routing] = await Promise.all([
      this.generateTokens(user.id, user.email, user.role),
      this.authRoutingService.resolve(user),
    ]);
    const session = await this.createSession(user.id, tokens.refresh_token);

    this.logger.info(sysMsg.LOGIN_SUCCESS);

    return {
      message: sysMsg.LOGIN_SUCCESS,
      user: this.toUserResponse(user),
      ...routing,
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  // Shared credential boundary for laboratory/organization administrators.
  async hashNewPassword(password: string): Promise<string> {
    return this.passwordCredentials.hashNewPassword(password);
  }

  async issueAuthSession(user: User) {
    this.accountAccessPolicy.assertCanAuthenticate(user);
    const [tokens, routing] = await Promise.all([
      this.generateTokens(user.id, user.email, user.role),
      this.authRoutingService.resolve(user),
    ]);
    const session = await this.createSession(user.id, tokens.refresh_token);

    return {
      ...routing,
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

    const user = await this.userService.findById(payload.sub);
    this.accountAccessPolicy.assertCanAuthenticate(user);
    if (!user) {
      throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    }
    if (!haveSameRoles(payload.role, user.role)) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const [tokens, routing] = await Promise.all([
      this.generateTokens(user.id, user.email, user.role),
      this.authRoutingService.resolve(user),
    ]);

    session.revoked_at = new Date();
    await this.sessionRepository.save(session);
    const newSession = await this.createSession(
      payload.sub,
      tokens.refresh_token,
    );

    this.logger.info(sysMsg.TOKEN_REFRESH_SUCCESS);

    return {
      message: sysMsg.TOKEN_REFRESH_SUCCESS,
      user: this.toUserResponse(user),
      ...routing,
      ...tokens,
      session_id: newSession.session_id,
      session_expires_at: newSession.expires_at,
    };
  }

  async forgotPassword(
    payload: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.challengeFlows.requestRecovery(payload.email);
  }

  async resetPassword(payload: ResetPasswordDto): Promise<{ message: string }> {
    const password = await this.passwordCredentials.hashNewPassword(
      payload.newPassword,
    );
    await this.challengeFlows.completeRecovery(
      payload.challenge_id,
      payload.code,
      password,
    );
    return { message: sysMsg.PASSWORD_RESET_SUCCESS };
  }

  async verifySignup(payload: VerifySignupDto) {
    const verifiedUser = await this.challengeFlows.verifyContact(
      payload.challenge_id,
      payload.code,
    );
    // Canonical refresh/session rotation belongs to #77. On #75's current
    // session model, credentials still require a committed verified account.
    const session = await this.issueAuthSession(verifiedUser);
    void this.sendWelcomeEmail(verifiedUser);
    return {
      message: sysMsg.ACCOUNT_VERIFIED,
      user: this.toUserResponse(verifiedUser),
      ...session,
    };
  }

  /** Called from lab and organization registration inside the SAME transaction. */
  async queueProvisionedVerification(
    manager: EntityManager,
    user: User,
  ): Promise<{
    challengeId: string;
    resendAfterSeconds: number;
    expiresInSeconds: number;
  }> {
    if (
      user.account_status !== AccountStatus.PENDING_VERIFICATION ||
      user.email_verified_at
    ) {
      throw new BadRequestException('A pending account is required.');
    }
    await this.challengeDelivery.assertLiveFlowReady(manager);
    return this.challengeDelivery.queueInTransaction(
      manager,
      user,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
  }

  async resendVerification(
    payload: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.challengeFlows.resend(payload.email);
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
      country: user.country,
      image: user.image,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async updateProfile(req: IRequestWithUser, dto: UpdateProfileDto) {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const update: UpdateProfileDto = {};
    if (dto.first_name !== undefined) {
      update.first_name = dto.first_name.trim();
    }
    if (dto.last_name !== undefined) {
      update.last_name = dto.last_name.trim();
    }
    if (dto.middle_name !== undefined) {
      update.middle_name = dto.middle_name?.trim() || null;
    }
    if (dto.gender !== undefined) {
      update.gender = dto.gender;
    }
    if (dto.dob !== undefined) {
      update.dob = dto.dob;
    }
    if (dto.phone !== undefined) {
      update.phone = dto.phone;
    }
    if (dto.country !== undefined) {
      update.country = dto.country;
    }
    if (dto.image !== undefined) {
      update.image = dto.image;
    }

    const saved = await this.userService.updateAuthenticatedProfile(
      userId,
      update,
    );
    this.logger.info(`Profile updated for user ${saved.id}`);

    return this.getProfile({
      ...req,
      user: { ...req.user, id: saved.id },
    } as IRequestWithUser);
  }

  async changePassword(req: IRequestWithUser, dto: ChangePasswordDto) {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      this.logger.warn(sysMsg.USER_NOT_FOUND);
      throw new UnauthorizedException(sysMsg.USER_NOT_FOUND);
    }

    const isCurrentPasswordValid = await this.passwordCredentials.verify(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException(sysMsg.INVALID_CURRENT_PASSWORD);
    }

    const password = await this.passwordCredentials.hashNewPassword(
      dto.newPassword,
    );
    await this.userService.replaceAuthenticatedPassword(
      user.id,
      user.password,
      password,
    );

    await this.sessionRepository
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revoked_at: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('revoked_at IS NULL')
      .execute();

    this.logger.info(`Password changed for user ${user.id}`);

    return { message: sysMsg.PASSWORD_CHANGED };
  }

  // `userId` is always the authenticated caller. Trusting a user id from the
  // request body let anyone revoke another account's session.
  async logout(userId: string, logoutPayload: LogoutDto) {
    const session = await this.sessionRepository.findOne({
      where: {
        session_id: logoutPayload.session_id,
        user_id: userId,
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

  async googleLogin(token: string) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    let payload: {
      email?: string;
      email_verified?: boolean;
      sub?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
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

    if (!payload?.email || !payload.sub || !payload.email_verified) {
      throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
    }

    const email = payload.email.toLowerCase();
    const derivedName = this.deriveNameFromGoogle(payload);
    let user = await this.userService.findByEmail(email);
    let isNewUser = false;

    if (!user) {
      const generatedPassword = crypto.randomBytes(24).toString('hex');
      const hashedPassword =
        await this.passwordCredentials.hashGeneratedSecret(generatedPassword);

      isNewUser = true;
      user = await this.userService.create({
        email,
        password: hashedPassword,
        first_name: derivedName.firstName,
        last_name: derivedName.lastName,
        middle_name: null,
        gender: null,
        dob: null,
        phone: null,
        role: [UserRole.PATIENT],
        is_active: true,
        is_verified: true,
        account_status: AccountStatus.ACTIVE,
        email_verified_at: new Date(),
        google_id: payload.sub,
      });
    } else {
      this.accountAccessPolicy.assertCanAuthenticate(user);
      if (user.google_id && user.google_id !== payload.sub) {
        throw new UnauthorizedException(sysMsg.INVALID_GOOGLE_TOKEN);
      }
      user = await this.userService.linkGoogleIdentity(
        user.id,
        payload.sub,
        derivedName,
      );
    }

    const [tokens, routing] = await Promise.all([
      this.generateTokens(user.id, user.email, user.role),
      this.authRoutingService.resolve(user),
    ]);
    const session = await this.createSession(user.id, tokens.refresh_token);

    if (isNewUser) {
      void this.sendWelcomeEmail(user);
    }

    return {
      message: sysMsg.LOGIN_SUCCESS,
      user: {
        ...this.toUserResponse(user),
        picture: payload.picture,
      },
      ...routing,
      ...tokens,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  private deriveNameFromGoogle(payload: {
    given_name?: string;
    family_name?: string;
    name?: string;
    email?: string;
  }): { firstName: string; lastName: string } {
    const given = this.cleanName(payload.given_name);
    const family = this.cleanName(payload.family_name);
    const fromEmail = this.splitEmailLocalPart(payload.email);
    const emailFirst = fromEmail?.firstName;
    const emailLast = fromEmail?.lastName;

    if (given || family) {
      return {
        firstName:
          given ||
          this.firstFromFullName(payload.name) ||
          emailFirst ||
          'OHealth',
        lastName:
          family || this.lastFromFullName(payload.name) || emailLast || 'User',
      };
    }

    const fullName = this.splitFullName(payload.name);
    if (fullName) {
      return fullName;
    }

    if (fromEmail) {
      return fromEmail;
    }

    return { firstName: 'OHealth', lastName: 'User' };
  }

  private cleanName(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private splitFullName(
    fullName?: string,
  ): { firstName: string; lastName: string } | null {
    const trimmed = fullName?.trim();
    if (!trimmed) {
      return null;
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return null;
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: 'User' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private firstFromFullName(fullName?: string): string | null {
    return this.splitFullName(fullName)?.firstName ?? null;
  }

  private lastFromFullName(fullName?: string): string | null {
    return this.splitFullName(fullName)?.lastName ?? null;
  }

  private splitEmailLocalPart(
    email?: string,
  ): { firstName: string; lastName: string } | null {
    if (!email) {
      return null;
    }
    const localPart = email.split('@')[0]?.replace(/\+.*$/, '');
    if (!localPart) {
      return null;
    }
    const parts = localPart
      .split(/[._-]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) {
      return null;
    }
    const firstName = this.titleCase(parts[0]);
    const lastName =
      parts.length > 1 ? this.titleCase(parts.slice(1).join(' ')) : 'User';
    return { firstName, lastName };
  }

  private titleCase(value: string): string {
    if (!value) {
      return value;
    }
    return value
      .toLowerCase()
      .split(' ')
      .map((word) => {
        const [first, ...rest] = word.split('');
        return first ? `${first.toUpperCase()}${rest.join('')}` : word;
      })
      .join(' ');
  }

  private async sendWelcomeEmail(user: User) {
    const appName = this.configService.get<string>('app.name') || 'OHealth';
    const fromAddress = this.configService.get<string>('mail.from.address');
    const fromName = this.configService.get<string>('mail.from.name');

    if (!fromAddress) {
      this.logger.warn('Welcome email not sent: MAIL_FROM_ADDRESS not set.');
      return;
    }

    try {
      await this.emailService.sendMail({
        from: { email: fromAddress, name: fromName },
        to: [{ email: user.email, name: user.first_name }],
        subject: `Welcome to ${appName}`,
        templateNameID: EmailTemplateID.WELCOME,
        templateData: {
          name: user.first_name,
          app_name: appName,
        },
      });
      this.logger.info('Welcome email sent', { email: user.email });
    } catch (error) {
      this.logger.error('Failed to send welcome email', error);
    }
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
