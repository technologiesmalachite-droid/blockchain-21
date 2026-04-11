# Backend Deployment: GitHub -> Railway + Vercel Frontend Connection

This guide deploys the backend API from GitHub to Railway and connects it to your Vercel frontend.

## 1) GitHub prerequisites

1. Push this repo to GitHub on branch `main`.
2. Confirm `backend/railway.toml` is present.

## 2) Create Railway backend service

1. In Railway, create a new project.
2. Select **Deploy from GitHub repo**.
3. Choose this repository.
4. Set the service root directory to `backend`.
5. Railway will use:
   - `backend/railway.toml`
   - health check: `/api/health`
   - start command: `npm run start:railway`

## 3) Required Railway environment variables (backend)

Set these in Railway service variables:

- `NODE_ENV=production`
- `PORT` (Railway provides this automatically)
- `DATABASE_URL=<railway postgres url>`
- `JWT_SECRET=<strong random secret>`
- `JWT_REFRESH_SECRET=<strong random secret>`
- `ENCRYPTION_KEY=<strong random 32-byte key>`
- `CLIENT_URLS=https://<your-vercel-domain>`
- `CLIENT_URL_PATTERNS=https://*.vercel.app`
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX=200`

Optional provider URLs:

- `REDIS_URL`
- `IDENTITY_PROVIDER_URL`
- `DIGILOCKER_PROVIDER_URL`
- `SANCTIONS_PROVIDER_URL`
- `CUSTODY_PROVIDER_URL`
- `PAYMENT_PROVIDER_URL`
- `OBJECT_STORAGE_BUCKET`

## 4) Get the public Railway URL

After deploy, copy the generated domain from Railway, for example:

- `https://malachitex-api-production.up.railway.app`

Validate:

- `GET https://<railway-domain>/api/health`

## 5) Connect Vercel frontend to Railway backend

In Vercel project environment variables:

- `NEXT_PUBLIC_API_BASE_URL=https://<railway-domain>/api`

Redeploy Vercel after adding/updating the variable.

## 6) Auth/KYC/Wallet/Trading API readiness checks

After deploy, verify these endpoints respond:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/kyc/status` (with auth)
- `GET /api/wallet/balances` (with auth)
- `GET /api/trade/open-orders` (with auth)

If CORS fails, update:

- `CLIENT_URLS` with exact frontend URL
- `CLIENT_URL_PATTERNS` with Vercel preview wildcard pattern
