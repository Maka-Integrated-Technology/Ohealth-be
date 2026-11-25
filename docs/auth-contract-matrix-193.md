# Canonical auth runtime-to-contract matrix (#193)

This matrix inventories the canonical `/api/auth` operations on `dev` after #139. `Public` means no bearer session; `JWT` means a current server-validated session. Every JSON success is wrapped by the global success interceptor; errors use the global exception filter. Statuses below are the committed OpenAPI statuses, including generic validation (400), authentication (401 where applicable), and unexpected server failure (500). The remaining named codes and branches are derived from the referenced controllers and services, not from the old examples.

| Operation | Authority and transport | Request and runtime branch | Success | Documented errors and side effects |
| --- | --- | --- | --- | --- |
| `GET registration/bootstrap` | Public, JSON | No body; reads current configured intents and legal versions | 200 metadata; `no-store` | 500 |
| `POST signup` | Public, JSON; optional UUID idempotency key | Five intent variants. Persona signup forbids `organization`; hospital/laboratory/pharmacy require details and derive type on server. Legal versions equal bootstrap values. | 201 pending challenge, no session | 400/409/500/503; verification delivery queued |
| `POST verify` | Public, JSON | Challenge UUID and six-digit email code | 200 mobile session | 400/500; consumes challenge |
| `POST verify/resend` | Public, JSON | Pending challenge UUID | 200 replacement/queued challenge | 400/429/500/503 |
| `POST login` | Public, JSON | Email and password, account-existence neutral | 200 login-code challenge | 400/401/429/500/503 |
| `POST login/verify` | Public, JSON | Login challenge UUID and six-digit code | 200 mobile session **or** MFA challenge | 400/500; MFA branch issues no session |
| `POST login/mfa/verify` | Public, JSON | MFA challenge UUID plus six-digit TOTP **or** 22-character recovery code | 200 mobile session; `no-store` | 400/500; recovery code is single-use |
| `POST login/resend` | Public, JSON | Pending login challenge UUID | 200 replacement/queued challenge | 400/429/500/503 |
| `POST forgot-password` | Public, JSON | Email; neutral response | 202 pending recovery challenge | 400/429/500/503 |
| `POST forgot-password/resend` | Public, JSON | Pending recovery challenge UUID | 200 replacement/queued challenge | 400/429/500/503 |
| `POST reset-password` | Public, JSON | Recovery challenge UUID, six-digit code, new secure password | 201 message | 400/500; sessions and proofs revoked |
| `POST refresh` | Public, mobile JSON | 43-character refresh credential in body | 200 access and rotated refresh credentials | 400/401/500; reuse revokes family |
| `POST logout` | JWT, mobile JSON | Current session UUID | 200 message | 400/401/500; current session revoked |
| `GET sessions` | JWT | No body | 200 owned session list | 401/500 |
| `POST sessions/revoke` | JWT, JSON | Owned session UUID | 200 message | 400/401/500 |
| `POST sessions/revoke-all` | JWT | No body | 200 message | 401/500; all owned sessions revoked |
| `POST browser/verify` | Public, browser origin + client header | Contact challenge UUID and code | 200 access token in JSON; refresh in HttpOnly cookie | 400/403/415/500/503; `no-store` |
| `POST browser/login/verify` | Public, browser origin + client header | Login challenge UUID and code | 200 browser session **or** MFA challenge | 400/403/415/500/503; refresh cookie only on session branch; `no-store` |
| `POST browser/login/mfa/verify` | Public, browser origin + client header | MFA challenge UUID, TOTP or recovery code | 200 browser session | 400/403/415/500/503; refresh cookie, `no-store` |
| `POST browser/refresh` | Public, browser origin + client header + cookie | No body or empty JSON object; rejects bearer, query and body credentials | 200 access token; rotated refresh cookie | 400/401/403/415/500/503; `no-store` |
| `POST browser/logout` | Public, browser origin + client header + cookie | No body or empty JSON object; rejects bearer, query and body credentials | 200 message; cookie cleared | 400/401/403/415/500/503; `no-store` |
| `POST oauth/google/transactions` | Public, JSON | Sign-in has no intent/legal fields. Signup supports only patient or professional and requires bootstrap legal versions. Link uses separate route. | 201 nonce-bound transaction | 400/409/422/429/500/503; stable `OAUTH_*` codes |
| `POST oauth/google/link/transactions` | JWT, JSON | Consumer and allowlisted audience; recent auth required | 201 nonce-bound transaction | 400/401/500/503; `OAUTH_RECENT_AUTH_REQUIRED` |
| `POST oauth/google/complete` | Public, mobile JSON | One-time transaction UUID/token and Google ID token; consumer must be mobile | 200 mobile session **or** MFA challenge; 202 contact challenge | 400/401/409/429/500/503; stable `OAUTH_*` codes |
| `POST browser/oauth/google/complete` | Public, browser origin + client header | One-time web-bound transaction and Google ID token | 200 browser session, MFA challenge, or link message; 202 contact challenge | 400/401/403/409/429/500/503; cookie only on session branch; `no-store` |
| `DELETE oauth/google/link` | JWT | Recent auth and another authenticator required | 200 message | 401/409/500; `OAUTH_*` codes |
| `POST 2fa/enable` | JWT, JSON | Password required; active factor re-enrollment also requires current six-digit **TOTP** | 200 enrollment secret/QR | 400/401/500; no recovery code here |
| `POST 2fa/confirm` | JWT, JSON | Pending enrollment six-digit TOTP | 200 recovery codes shown once | 400/401/500; existing sessions revoked |
| `POST 2fa/recovery-codes/regenerate` | JWT, JSON | Password and fresh six-digit TOTP | 200 new recovery codes shown once | 400/401/500; old codes invalidated |
| `POST 2fa/disable` | JWT, JSON | Password and fresh six-digit TOTP | 200 message | 400/401/403/500; sessions revoked |
| `GET me` | JWT | No body | 200 server-derived context and patient address | 401/500 |
| `PATCH me` | JWT, JSON | Owner patient fields only | 200 updated context | 400/401/500 |
| `PATCH me/professional-profile` | JWT, JSON | Active professional persona; owner fields only | 200 updated context | 400/401/403/500 |
| `POST me/profile-photo` | JWT, multipart | Active patient/professional; private image upload | 200 private photo metadata | 400/401/403/409/413/500 |
| `GET me/profile-photo` | JWT | Active patient/professional | 200 short-lived private download information | 401/403/404/500 |
| `DELETE me/profile-photo` | JWT | Active patient/professional | 202 removal state | 401/403/500 |
| `POST me/email-change/request` | JWT, JSON | Password-enabled: current password. Passwordless Google: session younger than ten minutes. MFA-enabled: six-digit TOTP in addition. | 200 candidate challenge | 400/401/403/429/500/503; `EMAIL_CHANGE_*` step-up codes |
| `POST me/email-change/resend` | JWT, JSON | Candidate challenge UUID | 200 replacement challenge | 400/401/403/429/500/503 |
| `POST me/email-change/confirm` | JWT, JSON | Candidate challenge UUID and six-digit code | 200 `sessions_revoked: true` | 400/401/403/429/500; all sessions revoked |
| `POST change-password` | JWT, JSON | Current and different secure new password | 200 `session_terminated: true` | 400/401/409/500; all sessions revoked |

Browser endpoints require an exact allowlisted `Origin`, `X-OHealth-Client: browser`, and `application/json` when a body exists. Refresh and logout reject nonempty bodies, bearer authorization, and query parameters. Browser refresh credentials are delivered exclusively through `Set-Cookie` and never through JSON. Mobile refresh credentials use JSON in both directions. `Cache-Control: no-store` applies to browser completions and refresh/lifecycle operations marked in their controllers.

The primary runtime sources are `auth.controller.ts`, `oauth/oauth.controller.ts`, `browser/browser-session.controller.ts`, `two-factor-auth.controller.ts`, `email-change/email-change.controller.ts`, `profile-photo/profile-photo.controller.ts`, and their services. The compiled contract is `contracts/openapi.json`; request variant generation lives in `src/openapi/auth-request-variants.ts`.
