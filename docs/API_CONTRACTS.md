# API contracts

Canonical machine-readable contract: [openapi.json](openapi.json), generated from shared Zod input schemas and the endpoint registry in `scripts/generate-openapi.ts`. Run `npm run api:contracts` after changes. The contract test checks route coverage. Collection responses use `{items, total?, page?}`; most Mongo resource records use `_id`, while public expert/service DTOs and users use `id`. This deliberate v0.1 distinction is reflected in the UI. Normalize it before a stable public API release.

## Transport

- Same-origin `/api`, JSON, UTC ISO instants, INR integer paise. Never send a client-calculated price or commission.
- Cookie `market_session`: HttpOnly, SameSite=Lax, path `/api`, Secure in production. No bearer token in browser storage.
- Mutations require `Origin` matching APP_ORIGIN and `X-Market-Request: 1`. Webhooks use raw bytes and provider signature instead.
- Error envelope: `{"error":{"code":"SLOT_UNAVAILABLE","message":"This slot is no longer available"}}`.
- 400 input/signature, 401 no valid session, 403 role/ownership/invite, 404 absent/private record, 409 state/conflict, 413 body limit, 429 throttling, 503 missing provider/release configuration. Unexpected errors disclose no internals.
- Pagination: page >=1, limit 1–100, default 24. Category count has no product cap. Current own services and exception snapshots cap at 100; these operational views require follow-up pagination for scale.

## Booking contract example

1. `GET /experts?category=<id>&mode=online&maxPrice=250000` returns published storefront cards. `GET /experts/<slug>` returns services and transaction-verified reviews.
2. `GET /services/<serviceId>/slots` returns `_id`, startsAt, endsAt for open intervals.
3. `POST /bookings` with `Idempotency-Key: <random-uuid>` and `{"slotId":"<id>","termsAccepted":true}` returns 201 Booking. Reusing the same customer/key/slot returns the same booking; another slot returns 409. A reservation is not payment or confirmation.
4. `POST /bookings/<id>/order` with `{}` returns `{orderId, amount, currency:"INR", keyId}` only if payment configuration passes. UI opens Razorpay Checkout with that server order.
5. `POST /bookings/<id>/payment/verify` accepts Razorpay's three result fields. Server compares the stored order, verifies HMAC and fetches capture status. A signed webhook can reach the same handler first. Browser success alone never confirms the booking.
6. `GET /bookings?scope=customer` gives paymentStatus, status, meetingStatus and private meetingUrl when ready. `pending_confirmation` is distinct from `confirmed`; authorized is distinct from captured.
7. Owner expert/admin calls `/bookings/<id>/action` with `accept`, `reject` or (after end time) `complete`. Customer may `cancel` their own eligible appointment.
8. Only after completion, the customer submits `/bookings/<id>/review` with `{rating:5,text:"..."}`. Database uniqueness prevents a second review.

## Auth contract

Email registration has no role parameter. Verification and password-reset codes expire in ten minutes and permit five attempts. Login requires verified email and an active invite when invite mode is selected. Google requires `/auth/google/nonce` followed by a verified ID token bearing that nonce; nonce consumption is atomic. Matching an existing email does not silently link an account. Phone OTP uses managed verification; invite-only users first link the phone from an authenticated email account. Password reset revokes all sessions. Beta invitation revocation is checked on authenticated requests.

## Admin and payout contracts

`PUT /admin/settings` requires all four policy fields. `commissionBps` 1000 means 10%. Admin policy overrides expert/service preferences, and only new reservations use the new policy. `payoutMode` can be manual or automatic but is independent of live environment and provider gates.

`POST /admin/bookings/<id>/reconcile` fetches provider payments and reconciles a missing capture/full refund using the normal idempotent path. Partial refunds freeze the booking as an exception. CLI `npm run reconcile` handles up to 100 least-recently reconciled orders per invocation; an operator schedule and full provider settlement report remain launch work.

`POST /admin/bookings/<id>/payout`: in manual mode `reference` records a payment already made outside the application. In automatic mode the API submits one conditional Route transfer. `submitted` is not `paid`; an unknown response blocks blind retry. Current operational transfer reconciliation and dispute closure are unfinished and therefore live source lock remains enabled.

## Versioning and current limitations

This contract is for internal beta v0.1, not a public partner API. Output object schemas are intentionally broad for dashboard aggregate views; identity, money, booking states and request bodies are explicit. Before public API commitments, complete exact response schemas, generated clients and backward-compatibility checks. See LAUNCH_READINESS.md for executed versus planned validation.

## Service replacement and confirmation inheritance

`PUT /expert/services/{id}` replaces the service inputs owned by the current expert. Omitting the optional `confirmationPolicy` clears any previous service override, so subsequent reservations inherit the expert profile preference (subject to admin policy). Explicit `auto` or `manual` sets a service override. This does not recompute existing bookings: their confirmation, price and commission snapshots remain unchanged. Set `active=false` to archive or `active=true` to enable publication; public discovery still requires an approved expert and active category. Future open/reserved slots must be closed before changing service duration.

## Dated availability editing

`POST /expert/slots` publishes a dated slot. `PUT /expert/slots/{id}` accepts the same `SlotInput` (`serviceId`, ISO `startsAt`) to update an owned open slot. The server derives `endsAt` from the active owned service duration and enforces 15-minute boundaries, a start more than one hour and less than 180 days ahead, and non-overlap across the expert's services. Creation/edit/removal serialize schedule mutations in Mongo transactions. Edits retain the slot ID; reservation races either observe the committed schedule or prevent the edit. Existing booking date, price and policy snapshots are not modified.

`DELETE /expert/slots/{id}` closes an owned open slot transactionally; it does not erase history. Held/booked slots cannot be edited or closed and return 409 `SLOT_UNAVAILABLE`. `GET /expert/slots?page=1&limit=6` returns upcoming nonclosed slots as `{items,total,page}`, ordered by start time. Date/time presentation uses the viewer's device timezone; storage and request timestamps are UTC/ISO. Recurrence remains outside the beta scope. OpenAPI now documents 47 paths / 54 operations.

## Expert earnings reports

`GET /expert/earnings` is owned and read-only. Query parameters: `months=3|6|12` (default 6), `timezone=<IANA name>` (default Asia/Kolkata), `status=all|paid|processing|submitted|unknown|failed`, and standard `page`/`limit` pagination for payout records. Invalid timezones and report periods return 400. A Mongo snapshot transaction reads bookings, payouts and marketplace payout settings without provider requests or financial mutations.

The response retains legacy captured-booking `totals` and adds an explicit `ExpertEarnings` OpenAPI schema. `summary.totalEarningsPaise` and `completedSessions` include only completed, captured, undisputed bookings; `pendingPayoutPaise` is that completed net without a payout recorded as paid. It includes delay/processing/review states and is not an immediately withdrawable balance. `thisMonthPaise` and zero-filled `monthly` rows use session end month in the requested timezone, with the latest known refund/dispute state. Amounts use immutable expert-net paise snapshots, not current service prices or commission settings.

`payouts`, `payoutTotal`, `payoutPage` and `payoutLimit` describe the selected owned payout page; the filter does not change earnings totals. Returned payout fields are limited to record/booking IDs, amount, mode/status, external/provider reference and creation date; internal notes are excluded. `asOf`, `timezone`, `currentMonth` and `payoutInfo` explain report timing and payout policy/readiness. The API supplies no bank details, tax invoice, bank-settlement certification or promise of automatic transfer. This report does not close the operational settlement/refund-after-payout blockers.

`GET /admin/experts` supports `q` (literal case-insensitive name/email/headline/bio, maximum 120 characters), `status` (all/pending/approved/rejected/suspended), `category` (ObjectId), `sort` (newest/oldest/slug), and existing page/limit. It returns filtered `items` and `total`, populated category names, limited user name/email and global `summary: {pending,approved,total,updatedThisMonth}`. updatedThisMonth counts profile updates since the UTC month start; it is not a monthly-active-user metric. Sort includes an ID tie breaker. Review mutation semantics are unchanged.

## Admin management lists

- `GET /admin/categories`: existing page/limit plus optional literal `q` (name/slug, max 120) and `status=all|active|inactive`. Each category includes `expertCount`, the stored count of expert profiles associated with that category. `total` respects filters.
- `GET /admin/invites`: admin-only page/limit, literal email `q` (max 120), `status=all|active|revoked`. Returns `{items,total}`; records expose only email, active and timestamps. Existing POST updates access; no message is sent.
- `GET /admin/payments`: admin-only read-only snapshot report. Supports page/limit, literal title/expert/customer-name or exact booking-ID `q`, booking `status`, payout status (`all|none|processing|submitted|paid|unknown|failed`), and inclusive UTC session-date `from`/`to` (YYYY-MM-DD). Reject invalid/reversed dates. Returns `{items,total,summary}` with name-only customer/expert references and optional `{bookingId,status,amountPaise}` payout. Global summary includes totalBookings, recordedPaidPaise, recordedPaidCount and payoutsToReconcile (processing/submitted/unknown). These are stored operational records, not external bank settlement certification. Existing reconciliation, payout and booking mutation gates remain unchanged.

Deployment rate limits derive client identity only from the configured immediate proxy IP; the production Nginx proxy overwrites forwarding headers. No API response schemas change. The application retains single-instance rate-limit storage; multi-instance scaling requires a shared store.

Provider configuration API: `GET /admin/integrations` returns `{available,revision,origin,providers}`. Each provider includes id/title/help/enabled/configured and fields `{key,label,secret,type,value,configured}`; secret values are always empty. `PUT /admin/integrations/{provider}` (email/google/calendar/phone) accepts `{revision,enabled,fields,clearSecrets,password}` with strictly provider-scoped field names. Requires current admin password, origin protection and current revision; returns redacted metadata. Blank secrets preserve existing values, explicit clearing removes them. Enabled settings must be complete. Mutations record only field names/enabled/revision, never secret/password values. Saving triggers no external provider operation; configured does not mean validated. Public `/config` and admin overview reflect the effective saved provider capabilities. Payment configuration remains separate.

Admin integration IDs now include email (EMAIL_PROVIDER smtp|ses), whatsapp and razorpay. Metadata fields may include options for select inputs. Razorpay values are staged only. POST /admin/integrations/{provider}/test requires {password,recipient,consent:true}, admin session and same-origin headers; email/whatsapp only, five attempts/client/15min. Returns {accepted:true,message} only after provider acknowledgment, not delivery. See OpenAPI for updated contract.
