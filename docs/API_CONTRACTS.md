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
