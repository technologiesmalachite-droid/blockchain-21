# MalachiteX Live Platform Structure

The codebase is organized to support modular services and provider abstraction for regulated exchange operations.

## Root

- `frontend/` Next.js app router UI
- `backend/` Express API and service modules
- `docs/schema/postgresql.sql` production database schema
- `docs/api/routes.md` route contract summary

## Backend

```text
backend/
  migrations/
    001_initial_schema.sql
  scripts/
    migrate.js
    seed.js
  src/
    config/
      env.js
    controllers/
      adminController.js
      authController.js
      kycController.js
      marketController.js
      paymentController.js
      supportController.js
      tradeController.js
      userController.js
      walletController.js
    db/
      pool.js
      transaction.js
    middleware/
      auth.js
      security.js
      validate.js
    models/
      schemas.js
    providers/
      contracts.js
      mockProviders.js
    repositories/
      auditLogsRepository.js
      authFactorsRepository.js
      balancesRepository.js
      complianceCasesRepository.js
      conversionsRepository.js
      depositAddressesRepository.js
      helpers.js
      kycCasesRepository.js
      kycProfilesRepository.js
      ledgerEntriesRepository.js
      marketsRepository.js
      ordersRepository.js
      outboxRepository.js
      paymentIntentsRepository.js
      sanctionsResultsRepository.js
      sessionsRepository.js
      supportTicketsRepository.js
      tradesRepository.js
      usersRepository.js
      walletsRepository.js
      walletTransactionsRepository.js
      withdrawalsRepository.js
    routes/
      adminRoutes.js
      authRoutes.js
      kycRoutes.js
      marketRoutes.js
      paymentRoutes.js
      supportRoutes.js
      tradeRoutes.js
      userRoutes.js
      walletRoutes.js
    services/
      complianceService.js
      kycService.js
      marketService.js
      providerRegistry.js
      tradingEngine.js
      userService.js
      walletEngine.js
    utils/
      helpers.js
      tokens.js
    workers/
      jobQueue.js
      outboxWorker.js
    server.js
```

## Frontend (core live flows)

```text
frontend/
  app/
    admin/page.tsx
    kyc/page.tsx
    trade/page.tsx
    wallet/page.tsx
    deposit/page.tsx
    withdraw/page.tsx
    login/page.tsx
    signup/page.tsx
  components/
    trade/TradingDesk.tsx
    auth/ProtectedRoute.tsx
  lib/
    auth-provider.tsx
    auth/session-store.ts
    api/client.ts
    api/auth.ts
    api/private-data.ts
```

## Provider abstraction model

- Identity, DigiLocker, sanctions, custody, and payment providers are accessed through interfaces in `backend/src/providers/contracts.js`.
- Environment-specific adapter selection is centralized in `backend/src/services/providerRegistry.js`.
- Mock adapters in `backend/src/providers/mockProviders.js` are safe defaults for local integration testing.

## Compliance and risk controls

- Jurisdiction-aware KYC options for `IN` and `US`.
- Sanctions screening and risk scoring on KYC submission.
- Compliance case creation for high-risk withdrawals and flagged KYC submissions.
- Admin case resolution, KYC review, and account restriction endpoints.
