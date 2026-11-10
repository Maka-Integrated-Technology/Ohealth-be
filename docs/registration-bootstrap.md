# Public registration bootstrap (Issue #136)

`GET /api/auth/registration/bootstrap` (under the configured API prefix) is
public and returns exactly the server-supported self-service intents, display
labels, and the currently accepted legal-document identifiers and versions.

Sample shape (versions are deployment configuration, **not** constants):

```json
{
  "intents": [
    {"intent": "patient", "label": "Patient"},
    {"intent": "healthcare_professional", "label": "Healthcare Professional"},
    {"intent": "pharmacy", "label": "Pharmacy"},
    {"intent": "laboratory", "label": "Laboratory"},
    {"intent": "hospital", "label": "Hospital"}
  ],
  "terms": {"document_type": "terms_of_service", "version": "terms-v1"},
  "privacy": {"document_type": "privacy_policy", "version": "privacy-v1"}
}
```

The legal document identifiers refer to the versioned Terms of Service and
Privacy Policy. Consumers must resolve the approved document content using
those identifiers and versions, **show both texts**, and capture explicit
acceptance before `POST /auth/signup`. This endpoint intentionally does not
serve legal content or invent externally hosted URLs. The product/legal team
must ensure referenced published content is available for every version.

The endpoint reads the **same** `registration.termsVersion`,
`registration.privacyVersion`, and `SIGNUP_INTENT_DEFINITIONS` already used by
registration validation. It never returns roles, permission grants, account
status, organization approval, keys, or the idempotency pepper. Its
`Cache-Control: no-store` response avoids a stale version being reused by a
shared or browser cache; the client should also refresh on form entry.

## Version rotation and stale forms

A deployment may publish new legal versions between the bootstrap request and
form submission. Signup remains authoritative: an older version is rejected
with the existing `400 Current legal documents must be accepted.` response.
Clients MUST re-fetch bootstrap metadata, show the new legal document content,
and obtain fresh explicit acceptance; they must not automatically substitute
the newer versions or consider prior acceptance to apply to them.

Future issue #137 will introduce stable machine-readable error codes. Do not
switch the existing signup error contract solely in this task; when #137
lands, clients should use the typed stale-legal-version error instead of
parsing English response text.

## Release checks

- Verify the public response has exactly the closed intent list and both legal
  identifiers, and no secrets or mutable authorization data.
- Verify a version change is visible on the next GET and rejected on signup
  until the user reaccepts the new terms/privacy.
- Verify the endpoint does not use sessions or create user records.
- Run unit tests, the isolated HTTP acceptance test, OpenAPI generation and
  compatibility checks, API-client generation, and full CI.
- Coordinate patient-mobile/dashboard consumer adoption; no consumer may
  hardcode legal versions as a permanent mechanism.
