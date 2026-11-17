# Authentication security events: privacy publication draft

Status: draft for security owner and DPO/legal owner review. This material does
not itself publish or approve a public privacy notice or legitimate-interest
assessment. Production activation requires their approved versions.

## Proposed privacy notice text

We keep limited authentication security events to protect accounts, investigate
unauthorized access, meet applicable regulatory requests, and establish or
defend legal claims. An event can record the type and outcome of an account
action, its time, account and session identifiers where available, and a coarse
request source. It does not record passwords, verification codes, tokens, MFA
secrets, recovery codes, request bodies, medical data, or full URLs.

We retain these events for 24 months from the time they occur. They remain in
our investigation database for the first 12 months and then in a private,
encrypted, immutable archive until expiry. Disaster-recovery backups expire
through their normal cycle, no later than 30 additional days. Access is limited
to approved security investigations, regulatory requests, or legal claims and
is logged. An approved, scoped legal hold may temporarily suspend deletion for
affected records; it is reviewed at least every 90 days and has a stated
expiry. Account deletion does not automatically erase security events that we
still need for those purposes. We assess erasure requests individually and
remove unrelated identifiers where feasible.

## Retention schedule entry

| Record | Purpose | Online | Archive | Final deletion | Backup tail | Hold |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication security event | Account security, investigations, regulatory requests, legal claims | 0–12 months from `occurred_at` | Months 13–24, private encrypted immutable versions | 24 months from `occurred_at` | At most 30 additional days | Scoped, dual-approved, expiring and reviewed at least every 90 days |

Archive manifests, receipts, and retention ledger entries contain operational
evidence. The DPO/legal owner must approve their own retention and
de-identification schedule before production activation. The event archive
cannot be used as a general analytics or profiling dataset.

## Legitimate-interest assessment draft

**Interest.** Prevent and investigate account takeover, misuse of sessions,
unauthorized access, and security incidents in a health service. This protects
users and the service and supports valid legal claims.

**Necessity.** Authentication state alone does not preserve evidence of denied
attempts, replay, conflicts, or revocations. A narrow, append-only event with
event type, outcome, time, and limited identifiers supports investigation and
reconstruction. Review whether each event type and identifier is necessary
before activation; remove any that is not.

**Balance and safeguards.** The data can reveal account activity and may be
sensitive by context. The design excludes credentials, codes, tokens, medical
data, bodies, and unsafe URLs. It restricts access, encrypts and locks archive
objects, logs access, separates maintenance privileges, limits online storage
to 12 months, and deletes the archive after 24 months except for approved
scoped holds. Provide the notice above and a channel for access and erasure
requests. The DPO/legal owner must assess local legal basis, reasonable user
expectations, residual risk, and whether any categories need a shorter period.

**Decision record to complete before production.** Record the DPO/legal owner,
security owner, approval date and reference, applicable jurisdiction and legal
basis, alternatives considered, retention justification, residual risks,
mitigations, review date, and links to the published notice and schedule.
