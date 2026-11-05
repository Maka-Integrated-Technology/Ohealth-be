# Password login-code verification

Password login is a two-step, pre-session flow. A correct email/password pair
does not issue credentials.

1. `POST /auth/login` validates the normalized email, password, and current
   account state. It queues a purpose-bound `login_verification` challenge and
   returns an opaque `challenge_id`, cooldown, and expiry. It returns no user,
   access token, refresh token, or session identifier.
2. The delivery worker sends the six-digit code using the dedicated login-code
   template. Codes are stored only as an HMAC and the recoverable delivery
   envelope is encrypted until delivery finishes.
3. `POST /auth/login/verify` accepts the challenge ID and code. One PostgreSQL
   transaction locks and consumes the challenge, revalidates account state,
   creates the canonical refresh session, stores only the refresh hash, and
   appends the security audit events.
4. `POST /auth/login/resend` accepts the opaque challenge ID. It uses the shared
   cooldown and abuse budgets, supersedes the prior usable login challenge, and
   returns the replacement challenge ID without accepting an email address.

Contact verification, password recovery, login verification, and future MFA
proofs are distinct purposes. A code issued for one purpose cannot satisfy
another.

## Existing-client migration

This intentionally changes the successful `POST /auth/login` response. Clients
must stop expecting credentials from that endpoint and instead:

- store only the returned `challenge_id` until verification completes;
- show the login-code screen and use the resend cooldown returned by the API;
- obtain credentials only from `POST /auth/login/verify`;
- treat the old immediate-token response as retired rather than supporting two
  permanent login paths.

Google authentication is unchanged here and remains governed by #79. Signup
verification remains governed by #78. All three flows must converge on the
canonical session issuer from #77.
