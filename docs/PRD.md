# Independent Expert Marketplace — PRD v0.1

Owner: Siva Prasad Galaba. Target: controlled beta on 1 November 2026, Asia/Kolkata.
Prepared: 20 October 2026. Working product name: Expert Market; final name/domain undecided.

## Product goal and boundary

Help a customer discover a verified professional, understand a paid service, book an available appointment, pay securely, attend, and leave an authentic review. Experts can also share a direct storefront link. Admins control marketplace admission, taxonomy, commissions, confirmation and payout policy.

This is a separate application, repository, database, sessions, OAuth application, deployment and secrets. No LMS imports, database access, migrations, deployments or shared credentials are permitted. The requested stack is React/TypeScript/Vite, Node/Express and MongoDB/Mongoose. Hybrid is interpreted as marketplace discovery plus expert storefronts, supporting online and in-person appointments. This interpretation is an explicit product assumption, not a previously approved brand decision.

## Personas and permissions

| Persona  | Allowed                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor  | Browse verified experts, categories, published services, availability and verified reviews                                                            |
| Customer | Authenticate, reserve/pay for own booking, see own private meeting information, cancel eligible appointments, review own completed paid appointment   |
| Expert   | All customer rights plus onboarding, own profile/services/availability, own bookings, accept/reject where policy permits, own earnings/payout history |
| Admin    | Verification, category management, settings, all bookings/payment exceptions, refunds/payout review, audit and launch readiness                       |

Registration cannot grant admin. Initial admin is created by an operator CLI. Every resource mutation enforces ownership server-side. A verified email is required before booking; phone-only users must add and verify email for meeting/email delivery. Identity linking never silently merges an unverified matching email. Auth scope: email/password with email verification and password reset; Google ID token verified on server; phone OTP using Twilio Verify adapter. Sessions use opaque secure cookies, hashed server storage and expiry. SMS vendor is replaceable.

## P0 functional requirements

1. **Onboarding and verification.** An authenticated user submits name, headline, biography, category IDs, languages, location, timezone and experience. Submission changes the profile to pending. Only admin approval publishes it. Edits to verified identity/claims require re-review; availability and service management remain separate. Rejection requires a reason. No sensitive verification documents are public. Document upload/KYC workflow is a beta blocker if required by the selected category or provider.
2. **Categories.** Admin creates, edits and archives categories with unique slugs. There is no business cap on category count; all APIs paginate. Archive hides affected listings until recategorized. Open professional taxonomy does not imply permission to provide regulated services without appropriate verification. Initial controlled cohort should avoid regulated advice until category-specific controls are reviewed.
3. **Profiles/services.** Public slug URL, bio, languages, experience, verification badge and reviews. A service has title, description, category, mode (online/in_person), duration (15-minute increments), INR price in integer paise and an optional expert confirmation preference. In-person services require a location. Only approved experts with active categories may sell. One-to-one appointments are P0; group events, downloads, subscriptions and asynchronous work are later.
4. **Discovery.** Search title/headline/bio/service title, filter category, language, mode and maximum price; pagination and empty/error states. Only approved profiles and active services/categories are returned. Price is the amount payable; no hidden customer surcharge in beta. Tax treatment must be approved before live payments.
5. **Availability.** Experts publish concrete UTC time intervals from their local timezone. A service owns each interval; intervals cannot overlap across any of that expert's services. Scheduling uses 15-minute boundaries. Beta uses explicit dated slots; recurring rule generation, external free/busy sync, daylight-saving recurrence and buffer configuration are follow-up work. Date displays use the viewer's timezone.
6. **Booking.** Customer chooses a future slot, accepts displayed price and cancellation terms, and receives a 10-minute payment hold. Price, commission, service title, mode/location and effective confirmation policy are immutable snapshots. One slot can have only one active reservation. Payment or confirmation timeout releases it. A late successful payment never revives a released booking; it becomes a refund exception. A customer cannot book themself.
7. **Confirmation.** Admin chooses force_auto, force_manual or expert_choice. In expert_choice, service preference overrides expert default. Payment must be captured before auto confirmation. Manual requests stay pending until the expert or admin accepts; a 24-hour deadline is capped at 30 minutes before the session. Rejection/timeout after payment requests a full refund. Policy updates affect new bookings only.
8. **Commission.** Admin sets 0–10000 basis points (0–100%). Commission is rounded once in integer paise; expert net equals gross minus commission. No hard-coded commission or retroactive recomputation. Processor fees/tax responsibility are a business decision before live activation, not silently deducted from expert balances.
9. **Payments.** Server creates Razorpay orders from stored booking totals. Checkout success alone is insufficient. Server validates signature and fetches payment; signed raw-body webhooks also drive the same idempotent transition. Match order, payment, amount, INR currency and captured state. Duplicate events do not duplicate ledger entries. Persist unmatched/ambiguous outcomes for reconciliation.
10. **Payouts.** Admin selects manual or automatic. Both require completed sessions, captured/reconciled payment, no refund/dispute, and the payout delay. Manual: operator pays externally, then records reference and evidence. Automatic: Razorpay Route only after account approval, linked-account onboarding and a separately passed transfer/reversal test. Automatic mode never silently falls back to an external payment. Initial code keeps live payouts locked pending operational validation.
11. **Meet and notifications.** A confirmed online booking queues automatic Google Calendar event/Meet creation using an authorized platform organizer; separate Google sign-in and Calendar credentials. Stable event/request IDs avoid duplicate meetings. Handle asynchronous conference provisioning, retries and operator-visible failure. In-person appointments skip Meet. Queue confirmation, rejection/cancellation, refund and reminder emails. Never expose Meet links in public discovery.
12. **Dashboards.** Customer: upcoming/past bookings, payment/confirmation/meeting status and review eligibility. Expert: verification, profile/services/slots, confirmation queue, earnings and payout history. Admin: onboarding queue, categories, policy settings, bookings, reconciliation exceptions, payout queue and beta blockers.
13. **Verified reviews.** Only the booking's customer, after a captured paid appointment has ended and is marked completed, may submit one 1–5 star review. Unique booking index. No self-review or anonymous review. Public badge means transaction-verified, not an endorsement of claims. Moderation removal requires a recorded reason and audit trail; no synthetic seed reviews.

## Operational rules and assumptions

Initial development defaults are 10% commission, expert-selected confirmation, manual payouts and a 48-hour payout delay. These are editable starting values, not approved business terms; the owner must choose beta policies before launch.

- Controlled beta: proposed 10–20 verified experts and up to 100 invited customers; owner confirms cohort. Invitations/allowlist must be enforced before deployment. This is not a scale promise.
- Beta cancellation: full refund before session start; after start admin handles disputes. Rescheduling is cancel and rebook in the first slice. No automatic refund after a payout. Freeze earnings on dispute.
- Completion is explicit by expert/admin after end time. Disputes and no-show workflows need operator review; elapsed time alone does not prove attendance.
- Initial country/currency: India/INR. Adult users. Clear consent, privacy, terms, refund, service and support policies are required for public beta.
- Accessible, keyboard-usable responsive UI with loading/error/empty states. Never render fake payment/Meet success when credentials are missing.
- Proposed targets: p95 read APIs <500 ms, booking writes <1 s excluding providers; 50 concurrent reservation attempts for one slot yield exactly one active booking; recovery point <=24h and recovery time <=2h. These are release criteria requiring measurement.

## Out of scope for 1 November

Native apps, chat, AI matching, subscriptions, packages, coupons, multi-currency, group webinars, calendar free/busy sync, automated tax filing, complex partial refunds, multi-party sessions and enterprise tenancy. Route automatic payouts are conditional: if approval/testing is incomplete, beta launches in manual mode only after its own payout controls pass.

## Success and release decision

Measure verified experts, profile→service→slot→payment funnel, paid booking conversion, confirmation SLA, meeting creation rate, completed sessions, refunds and customer satisfaction. Initial targets are hypotheses until beta data exists. Release is **NO-GO** until security, payment reconciliation and deployment/restore tests have evidence. The date never overrides a failed gate. Read LAUNCH_READINESS.md for the current truthful status.
