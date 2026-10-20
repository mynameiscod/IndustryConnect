# Independent marketplace instructions

- Work only in this project. Do not inspect, import, modify, migrate or deploy CodeBegun LMS code/data/config.
- Preserve the stack: React/TypeScript/Vite, Node/Express, MongoDB/Mongoose. Repository: `mynameiscod/IndustryConnect`. The owner authorized a public push on 20 October 2026 and plans to make the repository private later; do not change visibility without instruction.
- Read docs/LAUNCH_READINESS.md and docs/PRD.md before expanding scope. Track implemented, simulated and externally validated work separately.
- Keep live source lock in apps/api/src/config.ts until all P0 blockers and exact-commit release evidence are reviewed. Never manufacture passing evidence.
- Money is integer paise. Booking price/commission/confirmation snapshots are immutable. Use transactions for booking/slot/ledger/outbox mutations.
- Never trust browser checkout success. Verify signatures, fetched capture state, order/amount/currency and idempotency.
- Do not automatically retry ambiguous provider orders/transfers. Reconcile first. No fake Meet URLs or provider success.
- Credentials belong in ignored local environment or deployment secret management. Never commit tokens, OTPs, KYC documents or customer data.
- Run the relevant tests, type check and build after meaningful changes. Run full payment/concurrency tests for booking/money changes.
- Update OpenAPI and acceptance criteria when API behavior changes. Preserve the independent deployment boundary.
