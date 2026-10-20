# Controlled beta implementation roadmap

Target: 1 November 2026 (IST). This is a conditional target, not a promise. The plan assumes provider credentials/access arrive by 22 October, a responsive owner for product decisions, and daily development/testing capacity. Codex performs work when invoked; this document does not schedule autonomous future work.

| Date      | Stage                            | Deliverable and exit condition                                                                                                   |
| --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Oct 20    | 0 — Specification and foundation | PRD, architecture, schema, API contracts, acceptance matrix; independent repo/monorepo; disabled-by-default payments             |
| Oct 21–22 | 1 — Identity and supply          | Email/Google/phone auth; invite access; expert verification; categories/profile/service management; negative authorization tests |
| Oct 23–24 | 2 — Discovery and scheduling     | Search, storefront, dated availability, reservation transaction, concurrency/idempotency tests and three dashboards              |
| Oct 25–26 | 3 — Payments                     | Razorpay test Checkout/webhooks; immutable commissions; confirmation deadlines; reconciliation/refund exception handling         |
| Oct 27    | 4 — Fulfillment                  | Real Google Meet, notification/reminder delivery, completion/reviews, manual payout runbook; conditional Route validation        |
| Oct 28–29 | 5 — Hardening                    | Security/abuse review, dependency audit, privacy review, responsive/browser tests, load and worker recovery                      |
| Oct 30    | 6 — Staging rehearsal            | Fresh deployment, TLS, secrets, indexes, backup/restore/rollback, full payment reconciliation evidence                           |
| Oct 31    | Go/no-go                         | Owner reviews exact release commit, all P0 evidence and unresolved risks; invite cohort onboarded                                |
| Nov 1     | Controlled beta                  | Invite-only monitored release; manual payout mode unless Route independently approved/tested; daily reconciliation               |

## Work order and dependencies

1. Implement reservation and payment state invariants before expanding UI convenience features.
2. Complete providers in test mode before any money movement. Route may be deferred independently, but ordinary checkout cannot bypass its payment/security/deployment gates.
3. Prioritize exception queues and refund/reconciliation controls over new service types.
4. Fix P0 defects before onboarding the first external paying customer.

## Owner decisions/inputs

- Final brand, domain and hosting target. Repository is `mynameiscod/IndustryConnect`; owner authorized it to be public for the initial push and will move it to private later.
- Razorpay merchant/test keys + webhook secret; Route approval and linked accounts only if automatic payouts desired.
- Google OAuth client and Calendar organizer consent/refresh token; production allowed origins.
- Email sender/domain/SMTP provider; SMS Verify account and India delivery setup.
- Tax/receipt treatment, fees, cancellation/no-show/dispute policy, verification evidence and customer-support contact.
- Real admin identity, invited cohort, hosting/secrets/backup/monitoring access.

## Scope controls

No LMS dependency. No fake successful providers. No public release while access or reconciliation controls are incomplete. If Oct 30 gates fail, 1 November becomes an internal test-only beta, with no live transactions. Add-ons remain backlog until the core flow is proven.
