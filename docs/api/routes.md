# MalachiteX API Routes (Live-Ready)

Base URL: `/api`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/sessions`
- `POST /auth/verification/send`
- `POST /auth/verification/confirm`
- `POST /auth/2fa/setup`

## User

- `GET /user/profile`
- `PUT /user/profile`

## Markets

- `GET /markets`
- `GET /markets/:symbol`

## KYC / Compliance Onboarding

- `GET /kyc/options/:countryCode`
- `POST /kyc/submit`
- `GET /kyc/status`

## Wallet and Ledger

- `GET /wallet/balances`
- `GET /wallet/wallets`
- `POST /wallet/wallets`
- `POST /wallet/transfer`
- `POST /wallet/deposit-address`
- `POST /wallet/deposit-request`
- `POST /wallet/withdraw-request`
- `GET /wallet/history`
- `GET /wallet/ledger`

## Trading

- `POST /trade/quote`
- `POST /trade/order`
- `DELETE /trade/order/:orderId`
- `POST /trade/convert`
- `GET /trade/open-orders`
- `GET /trade/history`

## Fiat Rails / Payments

- `GET /payments/intents`
- `POST /payments/intents`
- `POST /payments/webhooks/provider`

## Admin

- `GET /admin/users`
- `GET /admin/kyc`
- `GET /admin/transactions`
- `GET /admin/analytics`
- `GET /admin/compliance/overview`
- `GET /admin/compliance/cases`
- `POST /admin/compliance/kyc-review`
- `POST /admin/compliance/account-restrictions`
- `POST /admin/compliance/cases/:caseId/resolve`
- `GET /admin/audit-logs`

## Support

- `GET /support`
- `POST /support`
