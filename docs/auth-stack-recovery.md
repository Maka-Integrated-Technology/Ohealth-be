# Authentication stack recovery after PR #113

The #75 live challenge integration is merged in #113 (squash 53114fc).
Production staging/load evidence is tracked separately by #114; it is not a
blocker to developing the stack below. The closed PR #100 and old downstream
heads must not be restored wholesale: loader/build/lint payload changes were
present in their inherited history.

## Recovery boundaries

Start with current protected dev (60974a8). Recover only reviewed feature files
and feature-specific hunks, preserving dev dependency locks, lifecycle hooks,
security scanner, deny-by-default guards, live challenge routes and delivery
worker. Registration references were read individually from 93c6100 (before
its overwritten final head); a timestamp alone is not a trust decision. New
recovery commits require maintainer signing and fresh independent review.

The intended stack is the replacement #78 PR -> #101 (#79) -> #102 (#80) ->
#103 (#90). The registration replacement targets dev. Each downstream PR must
show only its owning feature diff against the preceding recovered layer.

## Remaining blockers

| Layer               | Existing work preserved                                                                                                           | Remaining work before completion                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #78 registration    | Intent normalization, atomic persona/patient/owner/legal records, uniqueness migrations, HMAC retry receipts, bounded maintenance | Connect the canonical #75 delivery adapter; define retry behavior for consumed/superseded challenges; approve idempotency transport/cleanup cadence; wire one public signup contract with HTTP/OpenAPI/client tests; integrate #77 first-session issuance |
| #79 Google sign-in  | Provider-subject lookup/uniqueness, rejection of silent email linking, internal audited link/unlink                               | #78 new-identity onboarding; #77 canonical sessions/recent-auth/revocation; public nonce/state/CSRF link/unlink transport and e2e/compatibility evidence                                                                                                  |
| #80 auth context    | Database-derived personas and organization capabilities, scoped assertions                                                        | #77/#78/#79 integration; login/refresh response migration, endpoint guards, full role/organization matrix and HTTP/real-DB coverage                                                                                                                       |
| #90 patient profile | Additive address, allowlisted personal fields, internal ownership/transaction boundary                                            | #78/#80 dependencies; migrate existing GET/PATCH /auth/me, verified-session ownership, client compatibility and complete concurrency/e2e coverage                                                                                                         |

Issue #77 / PR #88 is still a shared dependency. Its rotating-session foundation
is not wired into live issuance, refresh or protected-request validation. Do
not describe #113's legacy-session revocation as completion of #77.

Keep the recovered feature PRs draft while implementation is incomplete. Old
cumulative CI runs do not validate new heads; run CI on each recovered stack
base and obtain signatures and fresh security/API approval before merging.
