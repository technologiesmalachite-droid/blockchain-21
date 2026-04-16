import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { depositRecordsRepository } from "../repositories/depositRecordsRepository.js";
import { walletAddressesRepository } from "../repositories/walletAddressesRepository.js";
import { walletLedgerEntriesRepository } from "../repositories/walletLedgerEntriesRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { creditWallet } from "./walletEngine.js";
import { getDepositStatus, normalizeDepositWebhook, verifyDepositWebhookSignature } from "./walletDepositProviderService.js";

const STATUS_RANK = {
  pending_confirmation: 1,
  confirming: 2,
  completed: 3,
  failed: 3,
};

const asString = (value) => (typeof value === "string" ? value.trim() : "");

const resolveStableStatus = (currentStatus, incomingStatus) => {
  const current = asString(currentStatus).toLowerCase();
  const incoming = asString(incomingStatus).toLowerCase();

  if (!incoming) {
    return current || "pending_confirmation";
  }

  if (!current) {
    return incoming;
  }

  if (current === "completed" || current === "failed") {
    return current;
  }

  if (incoming === "completed" || incoming === "failed") {
    return incoming;
  }

  return (STATUS_RANK[incoming] || 0) >= (STATUS_RANK[current] || 0) ? incoming : current;
};

const buildDepositIdentityKey = (event, ownerRecord) => {
  const txReference =
    asString(event.txHash).toLowerCase() ||
    asString(event.providerReference).toLowerCase() ||
    asString(event.eventId).toLowerCase() ||
    `${ownerRecord.address.toLowerCase()}:${event.asset}:${event.network}:${event.amount}`;

  return `wallet_deposit_${ownerRecord.userId}_${event.provider}_${event.asset}_${event.network}_${txReference}`;
};

const buildWebhookAuditMetadata = ({ event, signatureResult, statusResolution, transactionId, recordId }) => ({
  provider: event.provider,
  eventId: event.eventId,
  txHash: event.txHash,
  providerReference: event.providerReference,
  asset: event.asset,
  network: event.network,
  amount: event.amount,
  address: event.address,
  status: statusResolution.status,
  confirmations: statusResolution.confirmations,
  confirmationsRequired: statusResolution.confirmationsRequired,
  signature: signatureResult.reason,
  transactionId,
  depositRecordId: recordId,
});

export const processDepositWebhook = async ({ headers, rawBody, payload }) => {
  const signatureResult = verifyDepositWebhookSignature({ headers, rawBody });
  if (!signatureResult.valid) {
    const error = new Error("Invalid wallet webhook signature.");
    error.statusCode = 401;
    throw error;
  }

  const normalizedEvent = await normalizeDepositWebhook(payload);
  const statusResolution = getDepositStatus(normalizedEvent);

  const addressOwner = await walletAddressesRepository.findByAddress({
    address: normalizedEvent.address,
    asset: normalizedEvent.asset,
    network: normalizedEvent.network,
  });

  if (!addressOwner) {
    return {
      received: true,
      ignored: true,
      reason: "address_not_found",
      provider: normalizedEvent.provider,
      eventId: normalizedEvent.eventId || null,
    };
  }

  return withTransaction(async (db) => {
    const identityKey = buildDepositIdentityKey(normalizedEvent, addressOwner);
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [identityKey]);

    const wallet = await walletsRepository.create(
      {
        userId: addressOwner.userId,
        walletType: addressOwner.walletType,
        asset: normalizedEvent.asset,
      },
      db,
    );

    const transactionIdempotencyKey = `${identityKey}:tx`;
    let existingTransaction = await walletTransactionsRepository.findByIdempotencyKey(transactionIdempotencyKey, db);
    if (!existingTransaction && normalizedEvent.txHash) {
      existingTransaction = await walletTransactionsRepository.findByHashForUser(
        {
          userId: addressOwner.userId,
          txHash: normalizedEvent.txHash,
        },
        db,
      );
    }
    if (!existingTransaction) {
      existingTransaction = await walletTransactionsRepository.findLatestDepositByAddress(
        {
          userId: addressOwner.userId,
          asset: normalizedEvent.asset,
          network: normalizedEvent.network,
          destinationAddress: normalizedEvent.address,
        },
        db,
      );
    }
    const transactionStatus = resolveStableStatus(existingTransaction?.status, statusResolution.status);

    const transactionMetadata = {
      provider: normalizedEvent.provider,
      providerStatus: normalizedEvent.providerStatus,
      webhookEventId: normalizedEvent.eventId,
      confirmations: statusResolution.confirmations,
      confirmationsRequired: statusResolution.confirmationsRequired,
      latestWebhookAt: new Date().toISOString(),
      raw: normalizedEvent.metadata?.payload || payload,
    };

    const transaction = existingTransaction
      ? await walletTransactionsRepository.updateById(
        existingTransaction.id,
        {
          status: transactionStatus,
          txHash: normalizedEvent.txHash || existingTransaction.txHash,
          sourceAddress: normalizedEvent.sourceAddress || existingTransaction.sourceAddress,
          providerReference: normalizedEvent.providerReference || existingTransaction.providerReference,
          failureReason: transactionStatus === "failed" ? "Deposit failed at provider." : null,
          completedAt: transactionStatus === "completed" ? new Date().toISOString() : null,
          idempotencyKey: transactionIdempotencyKey,
          metadata: transactionMetadata,
        },
        db,
      )
      : await walletTransactionsRepository.create(
        {
          userId: addressOwner.userId,
          walletId: wallet.id,
          transactionType: "deposit",
          asset: normalizedEvent.asset,
          walletType: addressOwner.walletType,
          network: normalizedEvent.network,
          amount: normalizedEvent.amount,
          fee: 0,
          destinationAddress: normalizedEvent.address,
          sourceAddress: normalizedEvent.sourceAddress || null,
          txHash: normalizedEvent.txHash || null,
          providerReference: normalizedEvent.providerReference || null,
          status: transactionStatus,
          riskScore: 3,
          idempotencyKey: transactionIdempotencyKey,
          metadata: transactionMetadata,
          completedAt: transactionStatus === "completed" ? new Date().toISOString() : null,
        },
        db,
      );

    const recordIdempotencyKey = `${identityKey}:record`;
    const existingDepositRecord = await depositRecordsRepository.findByIdempotencyKey(recordIdempotencyKey, db);
    const depositStatus = resolveStableStatus(existingDepositRecord?.status, statusResolution.status);

    const depositRecord = await depositRecordsRepository.create(
      {
        userId: addressOwner.userId,
        walletId: wallet.id,
        walletTransactionId: transaction.id,
        asset: normalizedEvent.asset,
        network: normalizedEvent.network,
        walletType: addressOwner.walletType,
        expectedAmount: normalizedEvent.amount,
        txHash: normalizedEvent.txHash || null,
        sourceAddress: normalizedEvent.sourceAddress || null,
        status: depositStatus,
        confirmationsRequired: statusResolution.confirmationsRequired,
        confirmationsCount: statusResolution.confirmations,
        idempotencyKey: recordIdempotencyKey,
        metadata: {
          provider: normalizedEvent.provider,
          providerReference: normalizedEvent.providerReference,
          providerStatus: normalizedEvent.providerStatus,
          webhookEventId: normalizedEvent.eventId,
          latestWebhookAt: new Date().toISOString(),
        },
      },
      db,
    );

    let credited = false;
    const creditIdempotencyKey = `${identityKey}:credit`;

    if (transactionStatus === "completed" || (statusResolution.shouldCredit && depositStatus === "completed")) {
      const existingCredit = await walletLedgerEntriesRepository.findByIdempotencyKey(creditIdempotencyKey, db);

      if (!existingCredit) {
        await creditWallet(
          {
            userId: addressOwner.userId,
            walletType: addressOwner.walletType,
            asset: normalizedEvent.asset,
            amount: normalizedEvent.amount,
            referenceType: "deposit",
            referenceId: transaction.id,
            description: `Deposit confirmed via ${normalizedEvent.network}`,
            idempotencyKey: creditIdempotencyKey,
          },
          db,
        );
        credited = true;
      }
    }

    await auditLogsRepository.create(
      {
        action: credited ? "wallet_deposit_credited" : "wallet_deposit_webhook_processed",
        actorId: "wallet_provider",
        actorRole: "system",
        resourceType: "wallet_transaction",
        resourceId: transaction.id,
        metadata: buildWebhookAuditMetadata({
          event: normalizedEvent,
          signatureResult,
          statusResolution,
          transactionId: transaction.id,
          recordId: depositRecord.id,
        }),
      },
      db,
    );

    return {
      received: true,
      ignored: false,
      provider: normalizedEvent.provider,
      eventId: normalizedEvent.eventId || null,
      transactionId: transaction.id,
      depositRecordId: depositRecord.id,
      status: statusResolution.status,
      credited,
    };
  });
};
