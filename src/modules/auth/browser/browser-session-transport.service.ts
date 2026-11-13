import { Injectable } from '@nestjs/common';

import { AuthService } from '../auth.service';
import { VerifyAuthChallengeDto } from '../contracts';
import { VerifySignupDto } from '../dto/auth.dto';

interface IBrowserPresentation<T> {
  response: T;
  refreshCredential: string;
  sessionExpiresAt: Date;
}

@Injectable()
export class BrowserSessionTransportService {
  constructor(private readonly auth: AuthService) {}

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

  private present<
    T extends {
      message: string;
      access_token: string;
      refresh_token: string;
      session_id: string;
      session_expires_at: Date;
      user: unknown;
      routing_target: unknown;
      access_level: unknown;
      verification_status: unknown;
    },
  >(result: T): IBrowserPresentation<Omit<T, 'refresh_token'>> {
    const { refresh_token, ...response } = result;
    return {
      response,
      refreshCredential: refresh_token,
      sessionExpiresAt: result.session_expires_at,
    };
  }
}
