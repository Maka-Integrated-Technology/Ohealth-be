import { Injectable } from '@nestjs/common';

import { AuthService } from '../auth.service';
import { VerifyAuthChallengeDto } from '../contracts';
import { VerifySignupDto } from '../dto/auth.dto';
import { CompleteGoogleOAuthDto } from '../oauth/oauth.dto';
import { OAuthConsumer } from '../oauth/oauth.enums';
import { OAuthService } from '../oauth/oauth.service';

interface IBrowserPresentation<T> {
  response: T;
  refreshCredential: string;
  sessionExpiresAt: Date;
}

type BrowserOAuthCompletion =
  | ({ issuedSession: true } & IBrowserPresentation<Record<string, unknown>>)
  | { issuedSession: false; response: Record<string, unknown> };

@Injectable()
export class BrowserSessionTransportService {
  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
  ) {}

  async verifySignup(payload: VerifySignupDto) {
    return this.present(await this.auth.verifySignup(payload));
  }

  async verifyLogin(payload: VerifyAuthChallengeDto) {
    return this.present(await this.auth.verifyLogin(payload));
  }

  async refresh(refreshCredential: string) {
    return this.present(
      await this.auth.refreshToken({ refresh_token: refreshCredential }),
    );
  }

  logout(refreshCredential: string) {
    return this.auth.logoutByRefreshCredential(refreshCredential);
  }

  async completeGoogle(
    payload: CompleteGoogleOAuthDto,
  ): Promise<BrowserOAuthCompletion> {
    const result = await this.oauth.complete(payload, OAuthConsumer.WEB);
    if (!this.isSessionResult(result)) {
      return {
        issuedSession: false,
        response: result as Record<string, unknown>,
      };
    }
    return { issuedSession: true, ...this.present(result) };
  }

  private present<
    T extends {
      message: string;
      access_token: string;
      refresh_token: string;
      session_id: string;
      session_expires_at: Date;
      account_context: unknown;
    },
  >(result: T): IBrowserPresentation<Omit<T, 'refresh_token'>> {
    const { refresh_token, ...response } = result;
    return {
      response,
      refreshCredential: refresh_token,
      sessionExpiresAt: result.session_expires_at,
    };
  }

  private isSessionResult(value: unknown): value is {
    message: string;
    access_token: string;
    refresh_token: string;
    session_id: string;
    session_expires_at: Date;
    account_context: unknown;
  } {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.access_token === 'string' &&
      typeof candidate.refresh_token === 'string' &&
      typeof candidate.session_id === 'string' &&
      candidate.session_expires_at instanceof Date
    );
  }
}
