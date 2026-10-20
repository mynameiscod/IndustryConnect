# Launch readiness — 20 October 2026

**Decision: NO-GO for live transactions.** Target remains an invitation-only controlled beta on **1 November 2026 (IST)**, conditional on the gates below. The first working implementation is available; it is not yet a production-certified marketplace. Payment mode defaults to disabled, and a source-level lock prevents enabling live checkout even if live keys and an environment flag are supplied.

## Delivered

| Area                   | Current evidence and boundary                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Specifications         | Detailed PRD, architecture, database model, OpenAPI 3.1 (47 paths / 53 operations), acceptance matrix and dated roadmap                                                                    |
| Independence           | New local Git repository and npm monorepo; separate application/database/config; no LMS files modified                                                                                     |
| Identity               | Email/password + verification/reset, opaque sessions, role/ownership checks, Google nonce/ID-token adapter, Twilio Verify phone adapter, invite-only access and revocation                 |
| Expert supply          | Onboarding, admin verification, profile edits triggering re-review, unlimited paginated admin categories, service creation/edit/archive                                                    |
| Discovery              | Search, category/language/mode/price filters, public storefront, service details, ratings from real stored reviews; no fake provider success or public reviews                             |
| Scheduling             | Dated availability, cross-service overlap protection, UTC storage, transactional 10-minute holds, customer idempotency keys, confirmation policy snapshots and timeouts                    |
| Payments               | Server-created orders, raw webhook HMAC, server-side checkout signature + fetched-payment validation, capture deduplication, balanced commission snapshots, late-capture refund exceptions |
| Reconciliation         | Known-order capture and full-refund reconciliation; partial refunds/disputes freeze payouts; exception queue; CLI batch reconciliation                                                     |
| Fulfillment            | Durable Mongo job worker, automatic Calendar/Meet adapter with stable event IDs, cancellation, confirmation/reminder email adapter, retry/failed-job state                                 |
| Payouts                | Admin manual/automatic mode, completed-session/delay/capture checks, manual external-reference recording, conditional Route submission and unknown-outcome blocking                        |
| Reviews                | One review per paid completed owned booking, public verified label, admin moderation API with audit reason                                                                                 |
| UI                     | React customer dashboard, expert studio (profile/services/availability/earnings), admin verification/categories/policies/payments/invitations and readiness views                          |
| Deployment preparation | Non-root multi-stage Dockerfile, local Mongo replica-set Compose, GitHub Actions workflow, compiled API/worker smoke script and runbook                                                    |

## Executed checks

| Check                          | Result                            | What it proves / limits                                                                                                                                                                       |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript checks              | PASS                              | Shared contracts, API and React client compile under strict mode                                                                                                                              |
| Production build               | PASS                              | Shared package + Express build + Vite bundle generated; UI entry JS approximately 405 kB / 122 kB gzip                                                                                        |
| Automated tests                | **35 / 35 PASS** in 4 suites      | 7 deterministic domain/security-policy tests, 23 real Mongo integration tests, 1 API contract coverage test, 4 jsdom UI tests                                                                 |
| 50-way reservation contention  | PASS                              | Exactly one active booking against a real MongoDB 7.0.24 replica set                                                                                                                          |
| Payment/review invariants      | PASS with injected provider fakes | Duplicate capture idempotency, amount/currency/capture rejection, webhook HMAC, late payment vs rebooking, manual rejection/refund, full refund reconciliation, review eligibility/uniqueness |
| Identity/access checks         | PASS for covered cases            | Role/ownership, foreign origin, verified email flow, password session logout, invite denial/revocation, Google nonce replay rejection and private field exclusion                             |
| Payout checks                  | PASS with injected provider fakes | Single eligible manual payout record and automatic Route-unavailable block; no real bank transfer performed                                                                                   |
| Compiled deployment smoke      | PASS locally                      | API process startup, DB readiness, SPA/deep links, security headers, unauthenticated/origin rejection, disabled checkout, separate worker releasing expired reservation                       |
| npm dependency audit           | **0 reported vulnerabilities**    | Initial high-severity Nodemailer finding resolved by upgrading to 10.1.7; dependency scan is not a penetration test                                                                           |
| Formatting / contract coverage | PASS                              | Source formatted; all 53 JSON API operations documented                                                                                                                                       |

MongoDB 8.0.10 could not start in this execution environment because a file open was denied. A compatible MongoDB 7.0.24 build with Unix sockets disabled started successfully and ran the transaction tests. No production database was used. HTTP smoke testing used compiled processes; it was **not** a container or HTTPS deployment. No real provider calls were made by automated tests.

## External and implementation blockers

| ID  | Blocker                                                                 | Owner / next action                                                                                                                                                                         | Release impact                                                         |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| B01 | GitHub CI execution pending initial push                                | Destination is `mynameiscod/IndustryConnect`; owner authorized the initial public push on 20 October 2026 and will make it private later. Verify the workflow against the published commit. | Local verification passed; remote CI remains unverified                |
| B02 | Razorpay account/test credentials and webhook endpoint unavailable      | Owner supplies secret-manager access; developer executes real test-mode success/failure/capture/refund/reconciliation matrix                                                                | Blocks all live checkout                                               |
| B03 | Google Identity/Calendar credentials, SMTP and SMS setup unavailable    | Owner configures provider projects/consent/sender/Verify account; developer validates real deliveries and Meet lifecycle                                                                    | Blocks usable external beta auth/notifications/online fulfillment      |
| B04 | Hosting/domain/HTTPS/DB backup access unavailable; Docker absent here   | Owner selects isolated deployment; developer runs container + HTTPS staging + restore/rollback tests                                                                                        | Blocks external live deployment                                        |
| B05 | Financial exception operations incomplete                               | Complete ambiguous-order recovery, full settlement reporting, dispute closure/refund-after-payout controls, transfer reconciliation/reversals and documented operator handling              | Live source lock remains; automatic Route payouts must remain disabled |
| B06 | Security hardening review not complete                                  | Shared/distributed abuse controls, session/OTP/SSO adversarial tests, admin stronger authentication decision, consent/privacy/retention and PII review                                      | Blocks live activation                                                 |
| B07 | Real browser/mobile/accessibility and provider popup tests not executed | Run supported browser QA against staging, including Google and Razorpay popup/CSP behavior                                                                                                  | UI is built and jsdom-tested, not browser-certified                    |
| B08 | Production monitoring and remediation incomplete                        | Queue heartbeat/age alerts, failed-job replay tooling, provider failure alerts, reconciliation schedule, support runbook                                                                    | Blocks unattended live operation                                       |
| B09 | Business inputs unresolved                                              | Final brand/domain, support contact, verification evidence policy, tax/fees and final legal/refund/no-show policies; owner approves controlled cohort                                       | Blocks public live-beta readiness                                      |

## Explicit scope limits

- Availability is concrete dated slots, not recurrence or external calendar conflict synchronization. Rescheduling is cancel/rebook.
- No verification-document upload/KYC automation; approval is an admin decision. Route account readiness is an operator attestation and must be validated externally.
- Refund submission currently happens through an operator in Razorpay; the app reconciles provider refund state. No fabricated automatic refund success.
- Route transfer submission records `submitted` or `unknown`; settlement/reversal completion remains pending development/provider certification. No repeated ambiguous transfer attempts.
- Single API instance rate limiting is implemented; multi-instance distributed abuse controls are not yet installed.
- Dashboard aggregates/output schemas and some operational lists are v0.1; complete public API response schemas and full pagination at scale are follow-up work.
- Some internal provider/job DTOs use `any`; replace these boundaries with validated typed provider responses during hardening. This is a deliberate disclosed technical debt, not a claim of end-to-end schema safety.
- Repository destination is `mynameiscod/IndustryConnect` (public by owner instruction). No production deployment, external customer message or money movement occurred in this delivery.

## Next implementation order

1. Push to IndustryConnect and verify CI; complete provider credentials and test environments.
2. Close financial exception/settlement/dispute operations and strengthen auth/abuse controls.
3. Perform real provider integration, browser and full deployment/restore/rollback testing.
4. Review exact release commit and remaining P0 acceptance cases on 31 October. Keep 1 November internal/test-only if any gate fails. Remove the source lock only in a reviewed, evidence-backed change.

No future work or release is scheduled automatically by this repository.
