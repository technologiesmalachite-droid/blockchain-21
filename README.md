# MalachiteX

MalachiteX is a live-ready crypto exchange platform architecture with modular compliance controls, KYC onboarding, wallet and ledger services, spot trading flows, and an admin risk console.

## Stack

- Frontend: Next.js App Router + TypeScript + Tailwind CSS
- Backend: Node.js + Express + JWT + modular service layer
- Database: PostgreSQL (source of truth via migrations + repository layer)
- Realtime extension point: WebSocket-ready market/trade architecture
- Queue/worker extension point: Redis-ready outbox worker hooks

## Core capabilities implemented

- Registration/login/logout with refresh-token sessions
- Email/phone verification endpoints
- 2FA support for login and withdrawal-sensitive flows
- Jurisdiction-aware KYC orchestration (`IN` and `US`)
- Sanctions screening and risk scoring hooks
- Compliance case management and admin review endpoints
- Spot/funding wallets with internal transfer and ledger entries
- Spot order placement, conversion, and trade history
- Deposit address generation and withdrawal request controls
- Payment on-ramp/off-ramp intent abstraction
- Transaction-safe wallet, order, and withdrawal updates

## Provider abstractions

Pluggable interfaces are included for:

- Identity verification provider
- DigiLocker provider
- Sanctions screening provider
- Custody provider
- Payment rail provider

Mock adapters are included for local development and integration tests.

## Quick start

1. Copy `.env.example` to `.env`.
2. Ensure PostgreSQL is running and `DATABASE_URL` in `.env` is valid.
3. Install dependencies:

```bash
npm install
```

4. Run database migrations and local seed data:

```bash
npm --workspace backend run db:migrate
npm --workspace backend run db:seed
```

5. Start both frontend and backend:

```bash
npm run dev
```

6. Open:
- Frontend: `http://localhost:3000` (or next available port)
- Backend: `http://localhost:5000`

Optional:

- Run repository tests (requires `DATABASE_URL`): `npm --workspace backend run test:repositories`
- Run outbox worker loop: `npm --workspace backend run worker:outbox`

## Credentials (local seed)

- User: `trader@malachitex.com` / `DemoTrader123!`
- Admin: `admin@malachitex.com` / `AdminVault123!`

## Documentation

- API routes: `docs/api/routes.md`
- Folder structure: `docs/architecture/folder-structure.md`
- PostgreSQL schema: `docs/schema/postgresql.sql`

## Production rollout notes

Before mainnet release, replace mock adapters with regulated vendors, wire outbox processing to Redis workers, and configure secure key management, encrypted secrets, and infrastructure observability.

## Railway deployment (monorepo)

This repo is prepared for two Railway services:

1. `backend` service
2. `frontend` service

Suggested setup:

1. Create a Railway project and connect this GitHub repo.
2. Create service A from the `backend` folder (root directory: `backend`).
3. Create service B from the `frontend` folder (root directory: `frontend`).
4. Add required environment variables from `.env.example`:
   - Backend: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URLS`, etc.
   - Frontend: `NEXT_PUBLIC_API_BASE_URL` pointing to backend public URL.
5. Deploy both services. Health checks are defined in:
   - `backend/railway.toml`
   - `frontend/railway.toml`
