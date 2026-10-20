# Launch readiness - 20 October 2026

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

GitHub publication is complete at [mynameiscod/IndustryConnect](https://github.com/mynameiscod/IndustryConnect), public by owner authorization. [CI run 39396288669](https://github.com/mynameiscod/IndustryConnect/actions/runs/39396288669) passed against application commit `0ac9f215e9d77d9b096b4b92a68bb66efca6a11a`: strict type checks, all 35 tests, OpenAPI drift, production build, dependency audit and Docker image build. Building the image is not proof of container runtime, HTTPS staging, backup/restore or rollback readiness.

## External and implementation blockers

Local demo follow-up: a separate Docker MongoDB replica set on localhost port 27018 was initialized and fictional accounts seeded. API, Vite and worker processes were started locally with checkout disabled. HTTP health/readiness/discovery and customer/expert/admin login/dashboard API checks passed. Compiled deployment smoke passed, and npm audit reported zero vulnerabilities. The smoke fixture now also omits the Unix-only socket flag on Windows. These are local checks, not external provider, browser/accessibility, HTTPS staging or recovery certification; browser automation was unavailable in this session. Secrets and demo credentials are in ignored `.env` only.

### Current local follow-up (20 October 2026)

Reference homepage follow-up: rebuilt the Bootstrap homepage around the supplied IndustryConnect reference, with a generated illustrative hero photo, compact navigation, API-backed category tiles/search/filters, booking steps, real expert cards, verified public review stories, expert CTA and footer. No expert portraits, ratings or testimonials are fabricated. The footer email control routes to sign-in with the supplied address; it does not subscribe or send email. All 40 automated tests passed, including new stored-review and footer-navigation coverage. Browser automation remains unavailable, so visual/mobile/accessibility certification is pending. Live checkout remains disabled; no API behavior changed.

Bootstrap UI migration: all public, authentication, customer, expert and admin views now use locally bundled Bootstrap 5.3.8 layouts/components/utilities. The former custom component stylesheet was replaced with minimal avatar/text/icon rules. React controls the responsive navbar collapse; a regression test covers opening it and closing it after navigation. Local checks: all 38 tests PASS, strict type check PASS, production build PASS, served route/import checks PASS and checkout remains disabled. This is implementation and automated local evidence; visual browser/mobile/accessibility and external provider certification remain outstanding. No API behavior or live source lock changed.

Implemented an operator-only `recover-order` CLI path for ambiguous provider orders, with fetched receipt/amount/currency/partial-payment checks and transactional attachment/audit. Added regression coverage for mismatches, concurrent recovery and late capture. No HTTP API behavior changed. The live source lock is unchanged. This is partial B05 progress; settlement reporting, dispute closure, refund-after-payout and transfer/reversal controls remain blockers. No real provider validation has occurred. Local working-tree validation: strict type check PASS, production build PASS, all 37 tests PASS (including the full payment suite, 50-way reservation contention and two new recovery regressions). The test replica-set configuration now omits the Unix-only socket flag on Windows; the first run failed at Mongo startup before this fixture fix. Provider behavior is simulated through injected fakes; no provider calls, deployment or money movement occurred. The executed checks and CI link above still describe the earlier published commit, not exact-commit release evidence for these changes.

| ID  | Blocker                                                                 | Owner / next action                                                                                                                                                            | Release impact                                                         |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| B02 | Razorpay account/test credentials and webhook endpoint unavailable      | Owner supplies secret-manager access; developer executes real test-mode success/failure/capture/refund/reconciliation matrix                                                   | Blocks all live checkout                                               |
| B03 | Google Identity/Calendar credentials, SMTP and SMS setup unavailable    | Owner configures provider projects/consent/sender/Verify account; developer validates real deliveries and Meet lifecycle                                                       | Blocks usable external beta auth/notifications/online fulfillment      |
| B04 | Hosting/domain/HTTPS/DB backup access unavailable; Docker absent here   | Owner selects isolated deployment; developer runs container + HTTPS staging + restore/rollback tests                                                                           | Blocks external live deployment                                        |
| B05 | Financial exception operations incomplete                               | Complete ambiguous-order recovery, full settlement reporting, dispute closure/refund-after-payout controls, transfer reconciliation/reversals and documented operator handling | Live source lock remains; automatic Route payouts must remain disabled |
| B06 | Security hardening review not complete                                  | Shared/distributed abuse controls, session/OTP/SSO adversarial tests, admin stronger authentication decision, consent/privacy/retention and PII review                         | Blocks live activation                                                 |
| B07 | Real browser/mobile/accessibility and provider popup tests not executed | Run supported browser QA against staging, including Google and Razorpay popup/CSP behavior                                                                                     | UI is built and jsdom-tested, not browser-certified                    |
| B08 | Production monitoring and remediation incomplete                        | Queue heartbeat/age alerts, failed-job replay tooling, provider failure alerts, reconciliation schedule, support runbook                                                       | Blocks unattended live operation                                       |
| B09 | Business inputs unresolved                                              | Final brand/domain, support contact, verification evidence policy, tax/fees and final legal/refund/no-show policies; owner approves controlled cohort                          | Blocks public live-beta readiness                                      |

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

1. Complete provider credentials and test environments; repository publication and initial CI verification are complete.
2. Close financial exception/settlement/dispute operations and strengthen auth/abuse controls.
3. Perform real provider integration, browser and full deployment/restore/rollback testing.
4. Review exact release commit and remaining P0 acceptance cases on 31 October. Keep 1 November internal/test-only if any gate fails. Remove the source lock only in a reviewed, evidence-backed change.

No future work or release is scheduled automatically by this repository.
