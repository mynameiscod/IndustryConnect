# Acceptance tests and release evidence

Status keys: automated = covered by repository tests once run; manual = operator/provider environment required; planned = not yet complete. Execution results live in LAUNCH_READINESS.md; this document defines criteria, not a pass claim.

| ID        | Scenario                                                           | Expected outcome                                                                          |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| AUTH-01   | Register with email, verify code, login/logout                     | No admin escalation; cookie session; expired/reused code rejected; logout revokes session |
| AUTH-02   | Wrong password, wrong OTP, expired OTP and repeated attempts       | Generic failure, bounded attempts and rate limiting; no account enumeration               |
| AUTH-03   | Invalid Google issuer/audience/nonce/expiry                        | Reject; no session; correct verified identity succeeds                                    |
| AUTH-04   | Phone OTP and existing email collision                             | Provider validates code; explicit email verification/linking; no silent account takeover  |
| AUTH-05   | Foreign Origin or missing application header                       | Unsafe requests rejected, including login; signed webhook remains reachable               |
| RBAC-01   | Customer calls admin policy/category/verification route            | 403; no mutation                                                                          |
| RBAC-02   | Expert edits another expert's service/booking                      | 403/404; no data leak                                                                     |
| EXP-01    | Pending profile exists                                             | Absent from all public listing/detail responses                                           |
| EXP-02    | Admin approves; expert edits profile claims                        | Published after approval; edit returns to pending                                         |
| CAT-01    | Create >100 categories and paginate                                | No business limit, stable pagination, unique slug, archive hides affected services        |
| BOOK-01   | 50 customers reserve the same slot concurrently                    | Exactly one active booking and one claimed slot                                           |
| BOOK-02   | Concurrent overlapping availability across services                | At most one overlap accepted; transaction rollback leaves no orphan                       |
| BOOK-03   | Replay same idempotency key / different slot                       | Same booking / 409 payload conflict                                                       |
| BOOK-04   | Price/settings change after reservation                            | Original booking totals and effective policy preserved                                    |
| BOOK-05   | Hold expires then payment captured                                 | Slot remains released; refund_required; no Meet or payout                                 |
| BOOK-06   | Manual confirmation rejected or times out                          | Cancelled, slot released, refund required; accept after deadline rejected                 |
| PAY-01    | Valid checkout signature but payment is authorized only            | No confirmation until captured evidence                                                   |
| PAY-02    | Amount/currency/order mismatch or invalid webhook signature        | Reject; no paid booking/ledger/job                                                        |
| PAY-03    | Duplicate webhook ID, duplicate payment under another event ID     | Single capture ledger and booking effect                                                  |
| PAY-04    | Webhook before callback, callback before webhook, provider timeout | Consistent state; no double charge; ambiguous order creation is flagged                   |
| PAY-05    | Reconciliation finds capture absent locally                        | Same idempotent capture handler repairs record, or reports mismatch                       |
| PAY-06    | Refund/dispute after capture                                       | Freeze payouts, reconcile refund status, no false paid transfer                           |
| POLICY-01 | force_auto / force_manual / expert_choice                          | Precedence matrix applied and snapshotted                                                 |
| MONEY-01  | Commission 0, 10000 and rounding edge cases                        | Gross equals commission plus net in paise; out-of-range rejected                          |
| MEET-01   | Confirm online vs in-person                                        | Online queues one stable Calendar event; in-person has no Meet job                        |
| MEET-02   | Google returns pending or worker crashes after insert              | Retry fetches same event; no duplicate meeting; admin sees failed jobs                    |
| MAIL-01   | Delivery error/retry, reminder timing                              | Durable jobs; bounded retries; no OTP in logs; dead letters visible                       |
| REVIEW-01 | Unpaid, future, other-customer or duplicate review                 | Rejected; only paid completed own appointment eligible                                    |
| PAYOUT-01 | Manual selection and external reference                            | Eligible only after delay/reconciliation; audited record; no provider transfer            |
| PAYOUT-02 | Automatic mode but Route unavailable                               | Explicit block; no silent fallback and no fund movement                                   |
| PAYOUT-03 | Unknown transfer response, refund/dispute or repeat request        | No blind retry or double transfer; hold for reconciliation                                |
| GATE-01   | Live key without exact-commit security/payment/deployment evidence | Checkout and payouts disabled                                                             |
| DEPLOY-01 | Fresh image, DB migration/indexes, HTTPS, worker restart           | Health ready; session persists; queue resumes safely                                      |
| DEPLOY-02 | Backup restore, rollback and unavailable provider                  | Recovery objectives demonstrated; no fabricated success                                   |
| UI-01     | Mobile + desktop + keyboard, empty/error/loading                   | Core journey usable and accessible; no console errors                                     |
| BETA-01   | Uninvited account in invite-only deployment                        | Cannot authenticate/book; invited user succeeds                                           |

## Required external test matrix before any live transactions

Earnings reference follow-up (UI-EARN-01): summary cards and monthly chart use owned stored data; no sample balances, bank accounts, invoices or payout success states are fabricated. Test completed/captured/undisputed net, recorded-paid versus pending amounts, exclusion of refunds/disputes/incomplete/foreign sessions, zero-net completed sessions, timezone month boundaries and owned payout filtering/pagination. Report errors must show an error rather than successful zero balances. UI controls cover period/status queries and actual payout record references. Automated cases cover these paths; visual/mobile QA and external settlement certification remain pending.

Availability reference follow-up (UI-SLOT-01): verify separate date/start inputs, a service-derived readonly end, actual device timezone, dated-only repeat control, paginated slot cards and loading/error/empty states. Open slots support edit and close; held/booked slots expose no mutation controls. Failed edits retain the draft. Automated UI cases cover UTC request conversion, end calculation, edit/remove, reserved controls and invalid boundaries. Real Mongo cases cover ownership, overlap rollback, concurrent create/edit, reservation/edit snapshot consistency, held/booked protection and transactional closure/pagination. Browser/mobile visual QA remains pending.

Services reference follow-up (UI-SERVICE-01): verify the service list/editor/guidance layout; new/edit/reset forms; description counter; required in-person location; exact integer-paise submission; server-error draft retention; archive/republish actions and actual profile-review state. Pending experts may manage services but are not publicly discoverable. On service replacement, omitting `confirmationPolicy` clears a previous override; subsequent bookings inherit the profile policy subject to admin policy, while existing booking snapshots remain unchanged. Automated UI and Mongo integration cases cover these paths; browser/mobile visual QA remains pending.

Expert Studio reference follow-up (UI-STUDIO-01): profile fields update a local sidebar preview and character count without autosaving; switching workspace tabs preserves profile drafts. Submit retains the existing profile API contract and returns to pending review; failed submission preserves editable values and reports the server error. Verify the required fields, timezone selector, expanded preview, guidance links, account menu, all workspace tabs, and stacked mobile layout. Automated coverage checks draft persistence, submitted payload/pending status and failed-save recovery. Visual browser/mobile/accessibility certification remains pending.

Bootstrap UI follow-up (UI-01): review discovery/filter cards, expert details and booking selections, every authentication mode, customer bookings/reviews, expert profile/services/availability/earnings, all admin tabs and guidelines at mobile/desktop widths. Check collapsed navigation, keyboard focus, readable status badges, validation alerts, responsive tables and loading/empty/error states. The navbar state transition has automated coverage; served routes and Bootstrap import were checked locally. Visual/browser accessibility certification is still pending.

Order recovery (PAY-07): only a `creating`/`unknown` booking without a stored order accepts an operator-supplied provider order. Fetch and verify ID, booking receipt, integer paise amount, INR currency and `partial_payment=false`; reject mismatch without mutation. Concurrent recovery attaches once with an atomic audit entry. Never create/retry an order, release/reclaim a slot or extend a hold during recovery. Reconcile payments separately; a recovered late capture requires a refund. Automated regression cases are added; execution status is recorded in LAUNCH_READINESS.md.

Razorpay test UPI/card success/failure, delayed capture, duplicated signed webhooks, lost callback, refund and settlement reconciliation; Route linked account/transfer/reversal if enabled; real Google identity and Calendar consent/Meet generation; actual email and SMS delivery; HTTPS cookie/CSRF test; load/reservation race with replica set; container deployment, backup restore and rollback. Store date, commit, environment, tester and evidence link for each. Test results cannot be inferred from compiled adapters.

Booking dashboard reference (UI-BOOKINGS-01): personalized welcome, responsive discovery callout, icon navigation, explicit API-confirmed disabled-payment notice, illustrated customer/expert empty states and benefits. Existing populated booking actions and pagination remain connected. Customer accounts do not receive expert-only scope controls. Automated checks cover discovery navigation, expert scope and error-versus-empty handling. Browser/mobile visual verification remains pending.

Authentication reference (UI-AUTH-01): verify the responsive split story/form layout, email/phone/registration tabs, password visibility with draft retention, reset and verification/resend actions. Google must remain unavailable when unconfigured and use the real provider widget when configured. Automated UI tests exercise visibility and form navigation; real provider and browser/mobile visual certification remain separate.
