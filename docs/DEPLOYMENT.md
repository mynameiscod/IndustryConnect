# Deployment, reconciliation and incident runbook

## Isolation

Use a separate hosting project/container group, Mongo replica set/database, secret store, domain, OAuth clients, API keys and admin identities. Do not reuse LMS cookies or credentials. API and worker deploy the same immutable image/commit. The API serves the built Vite SPA, so browser traffic and `/api` share one HTTPS origin. Use a reverse proxy to terminate TLS. Configure exact trusted proxy hops and shared rate limits before scaling; do not blindly set Express trust proxy to true.

## Local reproducibility

`npm ci && npm run build` produces the shared package, API and SPA. `npm run smoke:deployment` starts compiled API and worker processes against an ephemeral Mongo replica set and verifies HTTP/auth/origin checks and worker slot expiry. It does not certify Docker, HTTPS or providers.

The Dockerfile uses a build stage and a non-root Node 24 runtime with production dependencies only. Build with `docker build -t expert-marketplace:<commit> .`. Start a second container from the same image with `node apps/api/dist/worker-main.js` as its command. Runtime healthcheck is intended for the API; override it for the worker and monitor queue age/worker heartbeat. The Compose file supplies only an isolated local development DB. Its unauthenticated Mongo service is not a production deployment configuration.

## Staging release procedure (required, not yet executed)

1. Create private repo and require CI on main. Install environment secrets through the hosting provider; never in image layers or logs.
2. Create an authenticated, encrypted Mongo replica set and least-privilege application user. Enable backups. Run index creation from a trusted release job; never drop indexes automatically. Check the partial unique slot index and booking/payment/ledger/review unique indexes.
3. Deploy API and worker with `PAYMENTS_MODE=disabled`. Verify `/api/health`, `/api/ready`, SPA refresh/deep links, DB readiness and HTTPS secure cookies. Prove all unauthenticated/foreign-origin/private-resource negative cases.
4. Bootstrap a real admin and invite a small internal cohort. Remove development fixtures. Configure email sender/domain, Google allowed origins/consent, organizer Calendar access and SMS delivery. Verify actual email, OTP and Meet creation/cancellation.
5. Use Razorpay **test** mode. Verify order amount/currency, signature/amount rejection, captured vs authorized behavior, callback/webhook ordering, duplicate events, timeout, late capture, refunds, dispute freezing and provider API reconciliation. Record provider evidence and booking/ledger IDs without secrets.
6. Validate manual payout bookkeeping and independent proof of external payment. Automatic Route remains disabled unless merchant approval, linked-account checks, transfer/settlement reconciliation and reversal handling are complete. A successful transfer API response does not prove final bank settlement.
7. Run load/abuse tests and a real browser/mobile/keyboard/accessibility pass. Resolve all high/critical findings. Add CSP review and security logging/monitoring.
8. Restore a fresh staging database from backup. Prove ledger totals, session/data isolation and outstanding holds/jobs. Roll back the image to the prior release and prove schema compatibility. Measure recovery objectives.
9. Owner/security/payment reviewers sign off the exact commit with evidence references. Only after remaining P0 implementation gaps are fixed may a reviewed change remove the source lock. A separate ignored release evidence JSON supplies commit/reviewer/time and security/reconciliation/deployment pass fields; never generate fake passing evidence. Live keys, HTTPS, invite mode and live environment flag must also match.

## Daily reconciliation before and during beta

- Run `npm run reconcile` from an authorized environment; it processes 100 least-recently reconciled known orders per invocation. Use an operator schedule and scale pagination before volume grows.
- Compare provider captured amounts against capture ledger totals; full refunds against refund postings; paid/submitted transfers against provider settlement records. The current CLI covers booking capture/refund reconciliation, not a complete bank/provider settlement report.
- Investigate `creating`/`unknown` orders in Razorpay using the booking ID as receipt. Do not create another order blindly. From the trusted operator environment, run `node --import tsx apps/api/src/cli.ts recover-order <bookingId> <orderId>` using the candidate order found in the provider dashboard. This fetches the order and requires matching ID, receipt, integer paise amount, INR currency and disabled partial payments. Attachment and its operator-CLI audit entry are atomic; concurrent recovery cannot overwrite an attached order. It does not create an order, confirm payment, extend the hold or revive an expired booking. Run `npm run reconcile` afterwards to fetch payment evidence; late capture remains a refund exception. A failed fetch/mismatch leaves the ambiguity unresolved. Do not clear order state manually. Recovery UI and automatic receipt search remain follow-up work.
- Process refund_required records in the Razorpay dashboard, then reconcile the booking. No automatic refund submission is implemented in this slice. Partial refunds/disputes remain frozen until an operator resolves them. Full settlement/reversal/dispute resolution is a launch blocker.
- Review failed jobs and meeting failures. Current worker retries up to eight attempts. Operator retry tooling, durable monitoring/alerting and documented remediation are still required.
- Verify zero unresolved payment mismatches before enabling any live transaction.

## Incident actions

Disable new checkout (PAYMENTS_MODE=disabled), stop automatic payouts and preserve webhook ingestion/reconciliation. Existing signed payment events still need handling. For an unknown transfer, do not retry; inspect provider records first. For suspected account compromise, revoke sessions, suspend the user/expert and preserve audit evidence. For provider outage, display a truthful pending/unavailable state, retain durable jobs and contact affected beta users through the approved support process.

## Required evidence fields

Commit SHA; staging deployment identifier; test date/time; tester/reviewer; test case IDs; observed outcomes; provider order/refund/transfer references; security findings; restore/rollback measurement; remaining exceptions. Keep secrets and unnecessary customer data out of evidence. Financial/tax/legal retention and final policies require owner decisions before live beta.

## Operations hardening — 22 October 2026

SSH now uses `icdeploy@187.126.127.154` with the dedicated local deployment key and audited sudo. Direct root SSH, password and keyboard-interactive SSH authentication are disabled; browser-console recovery remains available. UFW permits inbound TCP 22/80/443 only; Mongo has no published port and API port 4000 remains loopback-only. Fail2ban's SSH jail bans repeated failures. The automation account has passwordless sudo and must be treated as privileged; keep its key restricted.

Set `TRUSTED_PROXY_IP` to the Docker network's exact gateway (`172.18.0.1` for the current deployment). Express trusts only that immediate address at hop zero. Nginx overwrites X-Forwarded-For with the socket peer, sets the HTTPS scheme and clears Forwarded/X-Forwarded-Host. Never use trust-proxy=true or accept forwarding headers from an arbitrary client. Application rate limits remain per process; this deployment runs one API instance. Shared storage remains required before scaling to multiple instances.

The worker writes an atomic heartbeat only after a successful tick. Docker considers a missing, malformed, future or ten-minute-old heartbeat unhealthy. Container logs rotate at 10 MB with five files per container.

`industryconnect-backup.timer` runs at **02:30 IST daily** (21:00 UTC), retaining fourteen days under `/opt/industryconnect/backups` (root-only). Database archives include the isolated replica-set oplog; configuration is separately encrypted. GPG AES256 encryption uses a root-only passphrase file under the project's secret directory, excluded from the encrypted configuration itself. A recovery key copy is held only in ignored local runtime storage. This is same-server backup storage by owner choice, not protection against complete server/disk loss. No off-server replication is configured.

Restore test: run `sudo /opt/industryconnect/current/ops/restore-check.sh <completed-archive-path>`. It verifies checksums/config readability, restores into a temporary no-network Mongo container and compares application collection counts and ledger totals with the current source. It never restores over the running database. Concurrent writes may require a new backup/comparison. Review `/opt/industryconnect/backups/restore-last.json`; this test does not certify recovery at production scale.

`industryconnect-monitor.timer` runs each minute. It checks API readiness, all three containers, worker heartbeat, overdue/failed jobs, expired leases, ambiguous payment state, disk space, backup age/job result and HTTPS expiry. Persistent active checks are in `/opt/industryconnect/monitoring/state.json`; alert/recovery events are in `events.jsonl` and the system journal, with six-hour reminders. View `journalctl -u industryconnect-monitor.service` and `systemctl list-timers 'industryconnect-*'`. Configure an authorized JSON webhook through root-only `/opt/industryconnect/secrets/monitor.env` with `ALERT_WEBHOOK_URL` when a destination is supplied; delivery is not configured by default. Local alert logs rotate weekly. Alerts do not replay jobs or retry money operations.
