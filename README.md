# MalachiteX

MalachiteX is an original, production-style demo cryptocurrency exchange platform with a premium dark UI, modular Next.js frontend, Express backend, demo trading logic, wallet flows, and an admin console.

## Stack

- Frontend: Next.js App Router + TypeScript + Tailwind CSS
- Backend: Node.js + Express + JWT auth + in-memory demo services
- Database target: PostgreSQL schema included in `docs/schema/postgresql.sql`
- Charts: TradingView embed placeholder plus custom demo chart cards

## Quick start

1. Copy `.env.example` to `.env` and adjust values.
2. Install dependencies:

```bash
npm install
```

3. Start both apps:

```bash
npm run dev
```

4. Open:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Demo credentials

- User: `trader@malachitex.com` / `DemoTrader123!`
- Admin: `admin@malachitex.com` / `AdminVault123!`

## Project structure

- `frontend/` Next.js application and UI
- `backend/` Express API with modular routes and services
- `docs/schema/postgresql.sql` relational schema

## Notes

- All market data, balances, trades, KYC, and admin metrics are demo-safe by default.
- Risk disclosures are visible throughout the product.
- Futures and API docs are clearly marked as demo / coming soon where appropriate.
