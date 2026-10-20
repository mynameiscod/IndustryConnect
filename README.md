# IndustryConnect — independent marketplace MVP

An independent hybrid expert marketplace, developed with Codex for a **conditional controlled beta on 1 November 2026**. Working name only; final brand/domain remain undecided. **Live transactions are disabled and source-locked.** This is a substantial first implementation, not a production-certified launch.

No CodeBegun LMS files, database, credentials, infrastructure or code are used. The independent repository is [mynameiscod/IndustryConnect](https://github.com/mynameiscod/IndustryConnect). The owner authorized publishing it publicly on 20 October 2026 and plans to change its visibility to private later.

## Specifications

- [Detailed PRD](docs/PRD.md)
- [Architecture and decisions](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE.md)
- [API contracts](docs/API_CONTRACTS.md) and [OpenAPI 3.1](docs/openapi.json)
- [Acceptance test matrix](docs/ACCEPTANCE_TESTS.md)
- [Implementation roadmap](docs/ROADMAP.md)
- [Launch readiness and blockers](docs/LAUNCH_READINESS.md)
- [Deployment and reconciliation runbook](docs/DEPLOYMENT.md)

## Project layout

```text
apps/web          React + TypeScript + Vite customer/expert/admin UI
apps/api          Express + Mongoose API and separate durable job worker
packages/contracts Shared Zod schemas, policies and integer-money rules
docs              Product, architecture, contracts and release evidence
scripts           OpenAPI generation and local compiled deployment smoke
```

Node 24 and npm workspaces. MongoDB 7+ replica set required. Unit/integration tests run against a temporary real single-node replica set, not an in-memory JavaScript repository. Provider fakes are dependency-injected into tests only.

## Local setup

1. `npm ci`
2. Copy `.env.example` to `.env`; replace AUTH_PEPPER with a long random secret. Keep payment mode disabled.
3. Start the development database: `docker compose up -d`. The Compose DB is bound only to localhost and must never be public. When running Node on the host, use `mongodb://127.0.0.1:27017/expert_marketplace?replicaSet=rs0&directConnection=true`.
4. `npm run build`
5. `npm run db:indexes`
6. Create the first admin using ignored environment values ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (16+ characters), then `npm run admin:create`. It creates a matching beta invite. Never pass passwords on a command line or commit `.env`.
7. For an empty development database only, alternatively set DEMO_PASSWORD (16+ characters) in your local environment and run `npm run db:seed`. This creates fictional `customer@example.invalid`, `admin@example.invalid` and `expert1@example.invalid` through `expert4@example.invalid`. The supplied password is shared for these local fixtures. No provider calls or fake reviews are created.
8. Run `npm run dev` for API (4000) + Vite (5173). In a second terminal run `npm run worker` after building. Visit `http://localhost:5173`.

Without email/provider credentials, real email verification, SMS, Google and payments intentionally report unavailable. Seed accounts permit local UI development without pretending that integrations have passed. Never use demo accounts in staging/production.

## Validation

To preview the redesigned homepage without MongoDB or provider credentials, run `npm run preview:homepage`, then open `.runtime/industryconnect-homepage-preview.html` in a browser. This self-contained design preview uses clearly labeled fictional profiles and supports search, filters, navigation and FAQs. Authentication, profiles and booking flows require the full application above. See [homepage design notes](docs/HOMEPAGE_DESIGN.md).

```bash
npm run typecheck
npm test
npm run api:contracts
npm run build
npm run smoke:deployment
npm audit --audit-level=high
```

The Mongo test binary downloads on the first run. Linux tests use the Ubuntu 22.04 MongoDB 7.0.24 binary for compatibility with the execution environment. Docker image build and HTTPS deployment tests require an environment with Docker/hosting access. Local smoke tests are not production deployment approval.

## Credentials and integrations

Configure Razorpay test keys and webhook secret, Google Identity client, separate Calendar organizer consent/refresh token, SMTP sender and Twilio Verify credentials using the variables in `.env.example`. Use `/api/webhooks/razorpay` as the signed webhook endpoint. API and worker share the isolated database and secret configuration. SMTP must support TLS. Route is an additional opt-in; standard Razorpay Checkout does not establish Route eligibility.

## GitHub repository

Clone this independent repository:

```bash
git clone https://github.com/mynameiscod/IndustryConnect.git
cd IndustryConnect
```

Do not push this project into the LMS repository. [GitHub Actions](https://github.com/mynameiscod/IndustryConnect/actions) runs type checks, tests, contract drift checks, the production build, dependency audit and Docker image build on pushes and pull requests. See the launch-readiness report for execution evidence and remaining gates.

## Current delivery boundary

The core flow and provider adapters are implemented and locally tested as described in the readiness report. Real provider certification, operational refund/dispute/settlement controls, browser/accessibility validation and staging/backup/rollback remain launch gates. No money was moved; no messages were sent to customers; no production deployment was performed.
