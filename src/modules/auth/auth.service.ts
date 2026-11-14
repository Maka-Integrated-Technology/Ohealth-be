import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EntityManager } from 'typeorm';
import { Logger } from 'winston';

import { IRequestWithUser } from '../../common/types';
import { EmailTemplateID } from '../../constants/email-constants';
import * as sysMsg from '../../constants/system.messages';
import { EmailService } from '../email/email.service';
import { User } from '../user/entities/user.entity';
import { AccountStatus } from '../user/enums/account-status.enum';
import { UserService } from '../user/user.service';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { AuthContextService } from './context/auth-context.service';
import { AuthChallengeDeliveryService } from './challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from './challenges/auth-challenge.entity';
import { SecureAuthChallengeFlowsService } from './challenges/secure-auth-challenge-flows.service';
import {
  RegistrationBootstrapDto,
  RegisterAccountDto,
  ResendAuthChallengeDto,
  VerifyAuthChallengeDto,
} from './contracts';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifySignupDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthException } from './oauth/oauth.error';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { isLoginPasswordWithinLimit } from './password-policy/password-policy';
import { RegistrationService } from './registration/registration.service';
import { RefreshSessionService } from './sessions/refresh-session.service';

@Injectable()
export class AuthService {
  private readonly logger: Logger;

  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly authContext: AuthContextService,
    private readonly accountAccessPolicy: AccountAccessPolicyService,
    private readonly passwordCredentials: PasswordCredentialsService,
    private readonly challengeFlows: SecureAuthChallengeFlowsService,
    private readonly challengeDelivery: AuthChallengeDeliveryService,
    private readonly sessions: RefreshSessionService,
    private readonly registration: RegistrationService,
    @Inject(WINSTON_MODULE_PROVIDER) logger: Logger,
  ) {
    this.logger = logger.child({ context: AuthService.name });
  }

  async signup(
    signupPayload: RegisterAccountDto,
    idempotencyKey?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const response = await this.registration.register(
      signupPayload,
      idempotencyKey,
      metadata,
    );
    this.logger.info(sysMsg.ACCOUNT_CREATED);
    return response;
  }

  getRegistrationBootstrap(): RegistrationBootstrapDto {
    return this.registration.getBootstrap();
  }

  async login(loginPayload: LoginDto) {
    // Reject pathological passwords before querying account existence.
    if (!isLoginPasswordWithinLimit(loginPayload.password)) {
      await this.challengeFlows.rejectLoginAttempt();
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
    if (
      !user ||
      !isPasswordValid ||
      user.password_authentication_enabled === false
    ) {
      await this.challengeFlows.rejectLoginAttempt();
      throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
    }
    return this.challengeFlows.requestLogin(user);
  }

  async verifyLogin(payload: VerifyAuthChallengeDto) {
    const { user, session } = await this.challengeFlows.verifyLogin(
      payload.challenge_id,
      payload.code,
    );
    const accountContext = await this.authContext.resolve(
      user.id,
      session.session_id,
    );
    this.logger.info(sysMsg.LOGIN_SUCCESS);
    return {
      message: sysMsg.LOGIN_SUCCESS,
      account_context: accountContext,
      ...session,
    };
  }

  resendLogin(payload: ResendAuthChallengeDto) {
    return this.challengeFlows.resendLogin(payload.challenge_id);
  }

  // Shared credential boundary for laboratory/organization administrators.
  async hashNewPassword(password: string): Promise<string> {
    return this.passwordCredentials.hashNewPassword(password);
  }

  async issueAuthSession(user: User) {
    this.accountAccessPolicy.assertCanAuthenticate(user);
    const session = await this.sessions.issue(user.id, user.password);
    const accountContext = await this.authContext.resolve(
      user.id,
      session.session_id,
    );

    return {
      account_context: accountContext,
      ...session,
    };
  }

  async refreshToken(refreshToken: RefreshTokenDto) {
    const { userId, ...credentials } = await this.sessions.rotate(
      refreshToken.refresh_token,
    );
    const user = await this.userService.findById(userId);
    this.accountAccessPolicy.assertCanAuthenticate(user);
    if (!user) throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    const accountContext = await this.authContext.resolve(
      user.id,
      credentials.session_id,
    );

    this.logger.info(sysMsg.TOKEN_REFRESH_SUCCESS);

    return {
      message: sysMsg.TOKEN_REFRESH_SUCCESS,
      account_context: accountContext,
      ...credentials,
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
    const { user, session } = await this.challengeFlows.verifyContact(
      payload.challenge_id,
      payload.code,
    );
    const accountContext = await this.authContext.resolve(
      user.id,
      session.session_id,
    );
    void this.sendWelcomeEmail(user);
    return {
      message: sysMsg.ACCOUNT_VERIFIED,
      account_context: accountContext,
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

  async resendVerification(payload: ResendAuthChallengeDto) {
    return this.challengeFlows.resendContact(payload.challenge_id);
  }

  resendRecovery(payload: ResendAuthChallengeDto) {
    return this.challengeFlows.resendRecovery(payload.challenge_id);
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

    return this.authContext.resolve(user.id, req.user.sessionId);
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
    await this.sessions.replacePassword(user.id, user.password, password);

    this.logger.info(`Password changed for user ${user.id}`);

    return { message: sysMsg.PASSWORD_CHANGED };
  }

  // `userId` is always the authenticated caller. Trusting a user id from the
  // request body let anyone revoke another account's session.
  async logout(
    userId: string,
    logoutPayload: LogoutDto,
    currentSessionId?: string,
  ) {
    if (currentSessionId && logoutPayload.session_id !== currentSessionId) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }
    await this.sessions.revoke(userId, logoutPayload.session_id);

    this.logger.info(sysMsg.LOGOUT_SUCCESS);

    return {
      message: sysMsg.LOGOUT_SUCCESS,
    };
  }

  async logoutByRefreshCredential(refreshCredential: string) {
    await this.sessions.revokeByCredential(refreshCredential);
    this.logger.info(sysMsg.LOGOUT_SUCCESS);
    return { message: sysMsg.LOGOUT_SUCCESS };
  }

  listSessions(userId: string) {
    return this.sessions.list(userId);
  }

  async revokeAllSessions(userId: string) {
    await this.sessions.revokeAll(userId);
    return { message: sysMsg.LOGOUT_SUCCESS };
  }

  googleLogin(token: string): never {
    void token;
    throw new OAuthException('OAUTH_TRANSACTION_REQUIRED');
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
}
