# Compromised-password blocklist: pinned source and update procedure

The source is the UK National Cyber Security Centre 100,000 most-used password
dataset distributed in the MIT-licensed SecLists project. See
https://github.com/danielmiessler/SecLists and its LICENSE.

- Repository: `danielmiessler/SecLists`
- Snapshot commit: `c5a0b8c794699aa351e1425be4a33b2b88a20d1b`
- Path: `Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`
- Git blob: `38eb37702244f55fda75cab281eb2145cd7685b6`
- Local source: `security/password-blocklist/ncsc-100k.txt`
- Generated module: `src/modules/auth/password-policy/compromised-passwords.generated.ts`
- Generator: `scripts/security/update-password-blocklist.mjs`

The raw source is retained for offline, deterministic provenance checks; only
the generated TypeScript list is imported at runtime. The generator derives
a bounded set of **entire password values**, including likely whole-password
suffix variants of source values at least 12 characters long, and
context-specific passwords. It does not block substrings contained within
otherwise distinct passphrases. The generation applies NFC and
case-insensitive matching consistently with the central password policy.

## Updating safely

1. Review a **specific** upstream SecLists commit and its licensing/source.
   Inspect source diffs and any changes to the upstream corpus. Do not
   dynamically fetch an unpinned branch in production or during CI.
2. Copy the reviewed source snapshot into `ncsc-100k.txt`. Record the new
   snapshot commit here and update `PINNED_SOURCE_BLOB` in the generator to
   the exact Git blob SHA-1 of that file.
3. Run `npm run password-blocklist:generate`, then
   `npm run password-blocklist:check`. Review any changes to the generated
   module and keep service-specific entries in `CONTEXT_ENTRIES`.
4. Run `npm test`, security HTTP tests, lint, format and build; confirm the
   repository's CI gate passes. Require security review of changes to the
   source fingerprint, generator, policy, and blocklist behavior.
5. Schedule a quarterly corpus/source review and an earlier review after
   major disclosed credential breaches. The pinned snapshot is refreshed
   only through an audited PR, not by unauthenticated runtime network calls.

This is a defense against commonly guessed, expected and compromised
credentials, not a guarantee that every breached password is included.
Server-side throttling and account monitoring remain necessary (issue #75).
