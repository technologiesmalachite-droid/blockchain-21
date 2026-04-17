import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { p2pDisputesRepository } from "../repositories/p2pDisputesRepository.js";
import { p2pEscrowLocksRepository } from "../repositories/p2pEscrowLocksRepository.js";
import { p2pOffersRepository } from "../repositories/p2pOffersRepository.js";
import { p2pOrderMessagesRepository } from "../repositories/p2pOrderMessagesRepository.js";
import { p2pOrdersRepository } from "../repositories/p2pOrdersRepository.js";
import { p2pPaymentMethodsRepository } from "../repositories/p2pPaymentMethodsRepository.js";
import { walletAssetsRepository } from "../repositories/walletAssetsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { consumeLockedBalance, creditWallet, debitWallet, releaseLockedBalance } from "./walletEngine.js";
import { notifyUser } from "./notificationService.js";
import { toDecimal, toNumber } from "../utils/decimal.js";

const ORDER_STATUSES = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAID: "PAID",
  RELEASED: "RELEASED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
  EXPIRED: "EXPIRED",
};

const OFFER_STATUSES = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_AUTO_CANCEL_MINUTES = 15;
const DEFAULT_FIAT_CURRENCIES = ["USD", "INR", "EUR", "NGN"];

const createError = (message, statusCode = 400, code = "P2P_REQUEST_INVALID") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const normalizeSide = (value, fallback = "buy") => {
  const normalized = String(value || fallback).trim().toLowerCase();
  return normalized === "sell" ? "sell" : "buy";
};

const normalizeOfferTradeTypeFromViewSide = (side) => {
  const normalized = normalizeSide(side);
  return normalized === "buy" ? "sell" : "buy";
};

const normalizeAmount = (value, precision = 10) => {
  const normalized = toNumber(value, precision);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw createError("Amount must be greater than zero.", 400, "P2P_AMOUNT_INVALID");
  }
  return normalized;
};

const normalizeOptionalText = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const normalizeFiat = (value) => String(value || "").trim().toUpperCase();
const normalizeAsset = (value) => String(value || "").trim().toUpperCase();

const maskAccountNumber = (value) => {
  const raw = String(value || "").replace(/\s+/g, "");
  if (!raw) {
    return null;
  }

  if (raw.length <= 4) {
    return `****${raw}`;
  }

  return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
};

const maskUpiId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const [localPart, domain] = raw.split("@");
  if (!localPart || !domain) {
    return `${raw.slice(0, 2)}***`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
};

const toOfferView = (offer, takerSide) => ({
  id: offer.id,
  advertiser: {
    userId: offer.userId,
    nickname: offer.advertiserNickname,
    completionRate: offer.advertiserCompletionRate != null ? Number(offer.advertiserCompletionRate) : null,
    totalTrades: Number(offer.advertiserTotalTrades || 0),
  },
  tradeType: offer.tradeType,
  takerSide,
  assetCode: offer.assetCode,
  fiatCurrency: offer.fiatCurrency,
  walletType: offer.walletType,
  priceType: offer.priceType,
  price: Number(offer.price),
  totalQuantity: Number(offer.totalQuantity),
  remainingQuantity: Number(offer.remainingQuantity),
  minAmount: Number(offer.minAmount),
  maxAmount: Number(offer.maxAmount),
  terms: offer.terms || null,
  status: offer.status,
  autoCancelMinutes: Number(offer.autoCancelMinutes),
  paymentMethods: Array.isArray(offer.paymentMethods) ? offer.paymentMethods : [],
  createdAt: offer.createdAt,
  updatedAt: offer.updatedAt,
});

const toOrderView = (order, actorId, messages = null, dispute = null) => {
  const role = order.buyerUserId === actorId ? "buyer" : "seller";
  const counterparty = role === "buyer"
    ? { id: order.sellerUserId, nickname: order.sellerNickname }
    : { id: order.buyerUserId, nickname: order.buyerNickname };

  return {
    id: order.id,
    offerId: order.offerId,
    offerTradeType: order.offerTradeType,
    role,
    counterparty,
    buyerUserId: order.buyerUserId,
    sellerUserId: order.sellerUserId,
    assetCode: order.assetCode,
    fiatCurrency: order.fiatCurrency,
    walletType: order.walletType,
    unitPrice: Number(order.unitPrice),
    cryptoAmount: Number(order.cryptoAmount),
    fiatAmount: Number(order.fiatAmount),
    status: order.status,
    expiresAt: order.expiresAt,
    markedPaidAt: order.markedPaidAt || null,
    releasedAt: order.releasedAt || null,
    cancelledAt: order.cancelledAt || null,
    disputeOpenedAt: order.disputeOpenedAt || null,
    cancelReason: order.cancelReason || null,
    paymentMethod: order.paymentMethodId
      ? {
          id: order.paymentMethodId,
          type: order.paymentMethodType,
          label: order.paymentMethodLabel,
          accountName: order.paymentMethodAccountName,
          accountNumberMasked: order.paymentMethodAccountNumberMasked,
          upiIdMasked: order.paymentMethodUpiIdMasked,
          metadata: order.paymentMethodMetadata || {},
        }
      : null,
    offerTerms: order.offerTerms || null,
    offerPaymentMethods: Array.isArray(order.offerPaymentMethods) ? order.offerPaymentMethods : [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    messages: messages || undefined,
    dispute: dispute || undefined,
  };
};

const ensureOfferTradable = (offer) => {
  if (!offer) {
    throw createError("Offer not found.", 404, "P2P_OFFER_NOT_FOUND");
  }

  if (offer.status !== OFFER_STATUSES.ACTIVE) {
    throw createError("Offer is not active.", 409, "P2P_OFFER_NOT_ACTIVE");
  }

  if (toDecimal(offer.remainingQuantity).lte(0)) {
    throw createError("Offer no longer has available quantity.", 409, "P2P_OFFER_EMPTY");
  }
};

const assertOrderParticipant = (order, userId) => {
  if (!order || (order.buyerUserId !== userId && order.sellerUserId !== userId)) {
    throw createError("Order not found.", 404, "P2P_ORDER_NOT_FOUND");
  }
};

const isExpiredOrder = (order) => {
  if (!order?.expiresAt) {
    return false;
  }

  const expiresAt = new Date(order.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
};

const createSystemMessage = async ({ orderId, body, metadata = {}, db }) =>
  p2pOrderMessagesRepository.create(
    {
      orderId,
      senderUserId: null,
      messageType: "SYSTEM",
      body,
      metadata,
    },
    db,
  );

const logP2pEvent = (event, payload = {}) => {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      ...payload,
    }),
  );
};

const lockSellerEscrow = async ({ sellerUserId, walletType, assetCode, amount, orderReferenceId, db }) => {
  await debitWallet(
    {
      userId: sellerUserId,
      walletType,
      asset: assetCode,
      amount,
      referenceType: "p2p_order_lock",
      referenceId: orderReferenceId,
      description: `P2P escrow lock for ${assetCode}`,
      lockOnly: true,
      idempotencyKey: `p2p_lock_${orderReferenceId}`,
    },
    db,
  );
};

const unlockSellerEscrow = async ({ sellerUserId, walletType, assetCode, amount, orderId, db, reason }) => {
  await releaseLockedBalance(
    {
      userId: sellerUserId,
      walletType,
      asset: assetCode,
      amount,
      referenceType: "p2p_order_unlock",
      referenceId: orderId,
      description: reason || "P2P escrow unlocked",
      idempotencyKey: `p2p_unlock_${orderId}`,
    },
    db,
  );
};

const settleEscrowToBuyer = async ({ sellerUserId, buyerUserId, walletType, assetCode, amount, orderId, db }) => {
  await consumeLockedBalance(
    {
      userId: sellerUserId,
      walletType,
      asset: assetCode,
      amount,
      referenceType: "p2p_order_release",
      referenceId: orderId,
      description: `P2P escrow settled ${assetCode}`,
      idempotencyKey: `p2p_consume_${orderId}`,
    },
    db,
  );

  await creditWallet(
    {
      userId: buyerUserId,
      walletType,
      asset: assetCode,
      amount,
      referenceType: "p2p_order_release",
      referenceId: orderId,
      description: `P2P crypto received ${assetCode}`,
      idempotencyKey: `p2p_credit_${orderId}`,
    },
    db,
  );
};

const ensureSellerHasBalance = async ({ userId, walletType, assetCode, quantity }, db) => {
  const wallet = await walletsRepository.findByUserTypeAsset(
    {
      userId,
      walletType,
      asset: assetCode,
    },
    db,
  );

  const available = toDecimal(wallet?.availableBalance || 0);
  if (available.lt(toDecimal(quantity))) {
    throw createError("Insufficient balance to lock escrow for this trade.", 409, "P2P_ESCROW_INSUFFICIENT_BALANCE");
  }
};

const assertKycEligible = (user) => {
  if (user?.kycStatus !== "approved") {
    throw createError("KYC approval is required for P2P trading.", 403, "P2P_KYC_REQUIRED");
  }
};

const resolveOrderParticipants = ({ offer, takerUserId }) =>
  offer.tradeType === "sell"
    ? { buyerUserId: takerUserId, sellerUserId: offer.userId }
    : { buyerUserId: offer.userId, sellerUserId: takerUserId };

const resolveOfferPaymentMethodId = async ({ offerId, requestedPaymentMethodId, db }) => {
  const methodIds = await p2pOffersRepository.listOfferPaymentMethodIds(offerId, db);
  if (!methodIds.length) {
    throw createError("Offer has no active payment methods.", 409, "P2P_OFFER_PAYMENT_METHODS_MISSING");
  }

  if (requestedPaymentMethodId) {
    if (!methodIds.includes(requestedPaymentMethodId)) {
      throw createError("Selected payment method is not available for this offer.", 400, "P2P_PAYMENT_METHOD_NOT_ALLOWED");
    }
    return requestedPaymentMethodId;
  }

  return methodIds[0];
};

const notifyOrderEvent = async ({ event, order, actorId }) => {
  const messageMap = {
    order_created: "Your P2P order has been created. Complete payment before expiry.",
    order_paid: "Buyer marked the order as paid. Confirm funds received and release crypto.",
    order_released: "Crypto has been released to the buyer wallet.",
    order_cancelled: "Order was cancelled before completion.",
    order_expired: "Order expired before payment and escrow was released.",
    order_disputed: "A dispute has been opened for this order.",
    order_message: "New message in your P2P order chat.",
  };

  const message = messageMap[event] || "P2P order updated.";
  const targets = [order.buyerUserId, order.sellerUserId].filter((id) => id && id !== actorId);

  await Promise.all(
    targets.map((userId) =>
      notifyUser({
        userId,
        category: "p2p",
        severity: event === "order_disputed" ? "warning" : "info",
        title: "P2P order update",
        message,
        actionUrl: `/p2p/orders/${order.id}`,
        metadata: {
          orderId: order.id,
          event,
        },
      }),
    ),
  );
};

const expireSinglePendingOrder = async (orderId, actorId = "system") =>
  withTransaction(async (db) => {
    const order = await p2pOrdersRepository.findByIdForUpdate(orderId, db);
    if (!order || order.status !== ORDER_STATUSES.PENDING_PAYMENT || !isExpiredOrder(order)) {
      return null;
    }

    const escrow = await p2pEscrowLocksRepository.findByOrderIdForUpdate(order.id, db);
    if (escrow?.status === "LOCKED") {
      await unlockSellerEscrow({
        sellerUserId: order.sellerUserId,
        walletType: order.walletType,
        assetCode: order.assetCode,
        amount: Number(order.cryptoAmount),
        orderId: order.id,
        db,
        reason: "P2P order expired",
      });

      await p2pEscrowLocksRepository.updateByOrderId(
        order.id,
        {
          status: "UNLOCKED",
          unlockedAt: new Date().toISOString(),
          metadata: { reason: "expired" },
        },
        db,
      );
    }

    await p2pOffersRepository.adjustRemainingQuantity(
      {
        offerId: order.offerId,
        deltaQuantity: Number(order.cryptoAmount),
        updatedBy: actorId,
      },
      db,
    );

    const updatedOrder = await p2pOrdersRepository.setStatus(
      order.id,
      {
        status: ORDER_STATUSES.EXPIRED,
        cancelledAt: new Date().toISOString(),
        cancelReason: "payment_window_expired",
        updatedBy: actorId,
        metadata: { expiredAt: new Date().toISOString() },
      },
      db,
    );

    await createSystemMessage({
      orderId: order.id,
      body: "Order expired because payment was not completed in time.",
      metadata: { event: "order_expired" },
      db,
    });

    await auditLogsRepository.create(
      {
        action: "p2p_order_expired",
        actorId,
        actorRole: "system",
        resourceType: "p2p_order",
        resourceId: order.id,
        metadata: { offerId: order.offerId },
      },
      db,
    );

    return updatedOrder;
  });

const expireOverdueOrdersForUser = async (userId) => {
  const expired = await withTransaction(async (db) => {
    const overdue = await p2pOrdersRepository.listOverduePendingByUser(userId, db);
    const results = [];

    for (const item of overdue) {
      if (!isExpiredOrder(item)) {
        continue;
      }

      const lock = await p2pEscrowLocksRepository.findByOrderIdForUpdate(item.id, db);
      if (lock?.status === "LOCKED") {
        await unlockSellerEscrow({
          sellerUserId: item.sellerUserId,
          walletType: item.walletType,
          assetCode: item.assetCode,
          amount: Number(item.cryptoAmount),
          orderId: item.id,
          db,
          reason: "P2P order expired",
        });

        await p2pEscrowLocksRepository.updateByOrderId(
          item.id,
          {
            status: "UNLOCKED",
            unlockedAt: new Date().toISOString(),
            metadata: { reason: "expired" },
          },
          db,
        );
      }

      await p2pOffersRepository.adjustRemainingQuantity(
        {
          offerId: item.offerId,
          deltaQuantity: Number(item.cryptoAmount),
          updatedBy: userId,
        },
        db,
      );

      const updated = await p2pOrdersRepository.setStatus(
        item.id,
        {
          status: ORDER_STATUSES.EXPIRED,
          cancelledAt: new Date().toISOString(),
          cancelReason: "payment_window_expired",
          updatedBy: userId,
          metadata: { expiredAt: new Date().toISOString() },
        },
        db,
      );

      await createSystemMessage({
        orderId: item.id,
        body: "Order expired because payment was not completed in time.",
        metadata: { event: "order_expired" },
        db,
      });

      await auditLogsRepository.create(
        {
          action: "p2p_order_expired",
          actorId: userId,
          actorRole: "user",
          resourceType: "p2p_order",
          resourceId: item.id,
          metadata: { offerId: item.offerId },
        },
        db,
      );

      results.push(updated);
    }

    return results;
  });

  await Promise.all(expired.filter(Boolean).map((order) => notifyOrderEvent({ event: "order_expired", order, actorId: userId })));
  return expired;
};

export const getP2pConfig = async () => {
  const assets = await walletAssetsRepository.listActive();
  return {
    assets: assets.map((asset) => asset.asset),
    fiatCurrencies: DEFAULT_FIAT_CURRENCIES,
    paymentMethodTypes: ["bank_transfer", "upi", "manual"],
    orderStatuses: Object.values(ORDER_STATUSES),
  };
};

export const listMarketplaceOffers = async ({ user, side, assetCode, fiatCurrency, paymentMethodType, page, pageSize }) => {
  assertKycEligible(user);

  const takerSide = normalizeSide(side || "buy");
  const requiredTradeType = normalizeOfferTradeTypeFromViewSide(takerSide);

  const payload = await p2pOffersRepository.listMarketplace({
    requiredTradeType,
    assetCode: assetCode ? normalizeAsset(assetCode) : undefined,
    fiatCurrency: fiatCurrency ? normalizeFiat(fiatCurrency) : undefined,
    paymentMethodType: paymentMethodType ? String(paymentMethodType).trim().toLowerCase() : undefined,
    page,
    pageSize: pageSize || DEFAULT_PAGE_SIZE,
    excludeUserId: user.id,
  });

  return {
    items: payload.items.map((item) => toOfferView(item, takerSide)),
    pagination: payload.pagination,
    filters: {
      side: takerSide,
      assetCode: assetCode ? normalizeAsset(assetCode) : null,
      fiatCurrency: fiatCurrency ? normalizeFiat(fiatCurrency) : null,
      paymentMethodType: paymentMethodType ? String(paymentMethodType).trim().toLowerCase() : null,
    },
  };
};

export const listMyOffers = async ({ user }) => {
  assertKycEligible(user);
  const offers = await p2pOffersRepository.listByUser(user.id);

  return offers.map((offer) => ({
    ...toOfferView(offer, offer.tradeType === "sell" ? "sell" : "buy"),
    owner: true,
  }));
};

export const createPaymentMethod = async ({ user, payload }) => {
  assertKycEligible(user);

  const methodType = String(payload.methodType || "").trim().toLowerCase();
  if (!["bank_transfer", "upi", "manual"].includes(methodType)) {
    throw createError("Unsupported payment method type.", 400, "P2P_PAYMENT_METHOD_INVALID");
  }

  const label = String(payload.label || "").trim();
  const accountName = String(payload.accountName || "").trim();
  if (!label || !accountName) {
    throw createError("Payment method label and account name are required.", 400, "P2P_PAYMENT_METHOD_REQUIRED");
  }

  const accountNumberMasked = maskAccountNumber(payload.accountNumber);
  const upiIdMasked = maskUpiId(payload.upiId);

  if (methodType === "bank_transfer" && !accountNumberMasked) {
    throw createError("Account number is required for bank transfer.", 400, "P2P_BANK_ACCOUNT_REQUIRED");
  }

  if (methodType === "upi" && !upiIdMasked) {
    throw createError("UPI ID is required for UPI payment method.", 400, "P2P_UPI_REQUIRED");
  }

  return p2pPaymentMethodsRepository.create({
    userId: user.id,
    methodType,
    label,
    accountName,
    accountNumberMasked,
    upiIdMasked,
    metadata: payload.metadata || {},
    createdBy: user.id,
    updatedBy: user.id,
  });
};

export const updatePaymentMethod = async ({ user, methodId, payload }) => {
  assertKycEligible(user);

  const existing = await p2pPaymentMethodsRepository.findByIdForUser(methodId, user.id);
  if (!existing) {
    throw createError("Payment method not found.", 404, "P2P_PAYMENT_METHOD_NOT_FOUND");
  }

  const methodType = payload.methodType ? String(payload.methodType).trim().toLowerCase() : undefined;
  if (methodType && !["bank_transfer", "upi", "manual"].includes(methodType)) {
    throw createError("Unsupported payment method type.", 400, "P2P_PAYMENT_METHOD_INVALID");
  }

  const nextType = methodType || existing.methodType;
  const accountNumberMasked = payload.accountNumber ? maskAccountNumber(payload.accountNumber) : null;
  const upiIdMasked = payload.upiId ? maskUpiId(payload.upiId) : null;

  if (nextType === "bank_transfer" && !(accountNumberMasked || existing.accountNumberMasked)) {
    throw createError("Account number is required for bank transfer.", 400, "P2P_BANK_ACCOUNT_REQUIRED");
  }

  if (nextType === "upi" && !(upiIdMasked || existing.upiIdMasked)) {
    throw createError("UPI ID is required for UPI payment method.", 400, "P2P_UPI_REQUIRED");
  }

  const updated = await p2pPaymentMethodsRepository.updateByIdForUser(methodId, user.id, {
    methodType,
    label: normalizeOptionalText(payload.label),
    accountName: normalizeOptionalText(payload.accountName),
    accountNumberMasked,
    upiIdMasked,
    metadata: payload.metadata || {},
    isActive: payload.isActive,
    updatedBy: user.id,
  });

  if (!updated) {
    throw createError("Payment method not found.", 404, "P2P_PAYMENT_METHOD_NOT_FOUND");
  }

  return updated;
};

export const deletePaymentMethod = async ({ user, methodId }) => {
  assertKycEligible(user);
  const updated = await p2pPaymentMethodsRepository.deactivateByIdForUser(methodId, user.id, user.id);
  if (!updated) {
    throw createError("Payment method not found.", 404, "P2P_PAYMENT_METHOD_NOT_FOUND");
  }
  return updated;
};

export const listMyPaymentMethods = async ({ user, includeInactive = false }) => {
  assertKycEligible(user);
  return p2pPaymentMethodsRepository.listByUser(user.id, { includeInactive });
};

export const createOffer = async ({ user, payload }) => {
  assertKycEligible(user);

  const tradeType = normalizeSide(payload.tradeType, "sell");
  const assetCode = normalizeAsset(payload.assetCode);
  const fiatCurrency = normalizeFiat(payload.fiatCurrency);
  const walletType = payload.walletType === "spot" ? "spot" : "funding";

  if (!assetCode || !fiatCurrency) {
    throw createError("Asset and fiat currency are required.", 400, "P2P_OFFER_SYMBOL_REQUIRED");
  }

  const price = normalizeAmount(payload.price);
  const totalQuantity = normalizeAmount(payload.totalQuantity);
  const minAmount = normalizeAmount(payload.minAmount);
  const maxAmount = normalizeAmount(payload.maxAmount);

  if (maxAmount < minAmount) {
    throw createError("Maximum order amount must be greater than or equal to minimum amount.", 400, "P2P_OFFER_LIMITS_INVALID");
  }

  const paymentMethodIds = Array.isArray(payload.paymentMethodIds)
    ? payload.paymentMethodIds.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  if (!paymentMethodIds.length) {
    throw createError("At least one payment method is required.", 400, "P2P_OFFER_PAYMENT_METHOD_REQUIRED");
  }

  const autoCancelMinutes = Math.max(5, Math.min(120, Number(payload.autoCancelMinutes || DEFAULT_AUTO_CANCEL_MINUTES)));

  return withTransaction(async (db) => {
    const userMethods = await p2pPaymentMethodsRepository.findManyByIdsForUser(
      { userId: user.id, ids: paymentMethodIds, requireActive: true },
      db,
    );

    if (userMethods.length !== paymentMethodIds.length) {
      throw createError("One or more selected payment methods are invalid or inactive.", 400, "P2P_OFFER_PAYMENT_METHOD_INVALID");
    }

    if (tradeType === "sell") {
      await ensureSellerHasBalance(
        {
          userId: user.id,
          walletType,
          assetCode,
          quantity: totalQuantity,
        },
        db,
      );
    }

    const created = await p2pOffersRepository.create(
      {
        userId: user.id,
        tradeType,
        assetCode,
        fiatCurrency,
        walletType,
        priceType: "fixed",
        price,
        totalQuantity,
        remainingQuantity: totalQuantity,
        minAmount,
        maxAmount,
        terms: normalizeOptionalText(payload.terms),
        status: OFFER_STATUSES.ACTIVE,
        autoCancelMinutes,
        metadata: { instructions: normalizeOptionalText(payload.terms) },
        createdBy: user.id,
        updatedBy: user.id,
      },
      db,
    );

    await p2pOffersRepository.attachPaymentMethods(created.id, paymentMethodIds, db);

    await auditLogsRepository.create(
      {
        action: "p2p_offer_created",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "p2p_offer",
        resourceId: created.id,
        metadata: { tradeType, assetCode, fiatCurrency, totalQuantity, price },
      },
      db,
    );

    const hydrated = await p2pOffersRepository.findById(created.id, db);
    return toOfferView(hydrated, tradeType);
  });
};

export const updateOfferStatus = async ({ user, offerId, status }) => {
  assertKycEligible(user);
  const nextStatus = String(status || "").trim().toUpperCase();
  if (!Object.values(OFFER_STATUSES).includes(nextStatus)) {
    throw createError("Invalid offer status.", 400, "P2P_OFFER_STATUS_INVALID");
  }

  const updated = await p2pOffersRepository.updateStatusForUser(offerId, user.id, nextStatus, user.id);
  if (!updated) {
    throw createError("Offer not found.", 404, "P2P_OFFER_NOT_FOUND");
  }

  const hydrated = await p2pOffersRepository.findById(offerId);
  return toOfferView(hydrated || updated, updated.tradeType);
};

export const getOfferDetails = async ({ user, offerId }) => {
  assertKycEligible(user);
  const offer = await p2pOffersRepository.findById(offerId);
  if (!offer) {
    throw createError("Offer not found.", 404, "P2P_OFFER_NOT_FOUND");
  }

  return toOfferView(offer, normalizeSide(offer.tradeType === "sell" ? "buy" : "sell"));
};

export const createOrderFromOffer = async ({ user, offerId, payload }) => {
  assertKycEligible(user);
  const fiatAmount = normalizeAmount(payload.fiatAmount);

  logP2pEvent("p2p_order_create_attempt", { userId: user.id, offerId, fiatAmount });

  const created = await withTransaction(async (db) => {
    const offer = await p2pOffersRepository.findByIdForUpdate(offerId, db);
    ensureOfferTradable(offer);

    if (offer.userId === user.id) {
      throw createError("You cannot trade against your own offer.", 409, "P2P_SELF_TRADE_BLOCKED");
    }

    if (fiatAmount < Number(offer.minAmount) || fiatAmount > Number(offer.maxAmount)) {
      throw createError("Order amount must be within offer limits.", 400, "P2P_ORDER_LIMIT_INVALID");
    }

    const cryptoAmount = toNumber(toDecimal(fiatAmount).div(toDecimal(offer.price)), 10);
    if (toDecimal(cryptoAmount).gt(toDecimal(offer.remainingQuantity))) {
      throw createError("Order amount exceeds available offer quantity.", 409, "P2P_ORDER_EXCEEDS_AVAILABILITY");
    }

    const { buyerUserId, sellerUserId } = resolveOrderParticipants({ offer, takerUserId: user.id });

    await ensureSellerHasBalance(
      {
        userId: sellerUserId,
        walletType: offer.walletType,
        assetCode: offer.assetCode,
        quantity: cryptoAmount,
      },
      db,
    );

    const paymentMethodId = await resolveOfferPaymentMethodId({
      offerId: offer.id,
      requestedPaymentMethodId: payload.paymentMethodId,
      db,
    });

    const expiresAt = new Date(Date.now() + Number(offer.autoCancelMinutes || DEFAULT_AUTO_CANCEL_MINUTES) * 60 * 1000).toISOString();

    const order = await p2pOrdersRepository.create(
      {
        offerId: offer.id,
        buyerUserId,
        sellerUserId,
        paymentMethodId,
        assetCode: offer.assetCode,
        fiatCurrency: offer.fiatCurrency,
        walletType: offer.walletType,
        unitPrice: Number(offer.price),
        cryptoAmount,
        fiatAmount,
        status: ORDER_STATUSES.PENDING_PAYMENT,
        expiresAt,
        metadata: { createdFromOfferId: offer.id },
        createdBy: user.id,
        updatedBy: user.id,
      },
      db,
    );

    await lockSellerEscrow({
      sellerUserId,
      walletType: offer.walletType,
      assetCode: offer.assetCode,
      amount: cryptoAmount,
      orderReferenceId: order.id,
      db,
    });

    await p2pEscrowLocksRepository.create(
      {
        orderId: order.id,
        userId: sellerUserId,
        walletType: offer.walletType,
        assetCode: offer.assetCode,
        amount: cryptoAmount,
        status: "LOCKED",
        metadata: { offerId: offer.id },
      },
      db,
    );

    await p2pOffersRepository.adjustRemainingQuantity(
      {
        offerId: offer.id,
        deltaQuantity: -cryptoAmount,
        updatedBy: user.id,
      },
      db,
    );

    await createSystemMessage({
      orderId: order.id,
      body: "Order created. Buyer should complete payment before expiry.",
      metadata: { event: "order_created" },
      db,
    });

    await auditLogsRepository.create(
      {
        action: "p2p_order_created",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "p2p_order",
        resourceId: order.id,
        metadata: { offerId: offer.id, buyerUserId, sellerUserId, fiatAmount, cryptoAmount },
      },
      db,
    );

    return order;
  });

  logP2pEvent("p2p_order_create_success", { userId: user.id, orderId: created.id, offerId });
  await notifyOrderEvent({ event: "order_created", order: created, actorId: user.id });

  const hydrated = await p2pOrdersRepository.findByIdForParticipant(created.id, user.id);
  return toOrderView(hydrated || created, user.id);
};

export const listMyOrders = async ({ user, status, page, pageSize }) => {
  assertKycEligible(user);
  await expireOverdueOrdersForUser(user.id);

  const payload = await p2pOrdersRepository.listByUser(user.id, {
    status: status || undefined,
    page,
    pageSize: pageSize || DEFAULT_PAGE_SIZE,
  });

  return {
    items: payload.items.map((order) => toOrderView(order, user.id)),
    pagination: payload.pagination,
  };
};

export const getOrderById = async ({ user, orderId }) => {
  assertKycEligible(user);

  const maybeExpired = await expireSinglePendingOrder(orderId, user.id);
  if (maybeExpired) {
    await notifyOrderEvent({ event: "order_expired", order: maybeExpired, actorId: user.id });
  }

  const order = await p2pOrdersRepository.findByIdForParticipant(orderId, user.id);
  assertOrderParticipant(order, user.id);

  const [messages, dispute] = await Promise.all([
    p2pOrderMessagesRepository.listByOrderId(order.id),
    p2pDisputesRepository.findByOrderId(order.id),
  ]);

  return toOrderView(order, user.id, messages, dispute);
};

export const listOrderMessages = async ({ user, orderId }) => {
  assertKycEligible(user);
  const order = await p2pOrdersRepository.findByIdForParticipant(orderId, user.id);
  assertOrderParticipant(order, user.id);
  return p2pOrderMessagesRepository.listByOrderId(orderId);
};

export const postOrderMessage = async ({ user, orderId, body }) => {
  assertKycEligible(user);

  const trimmed = String(body || "").trim();
  if (trimmed.length < 1) {
    throw createError("Message cannot be empty.", 400, "P2P_ORDER_MESSAGE_EMPTY");
  }

  const order = await p2pOrdersRepository.findByIdForParticipant(orderId, user.id);
  assertOrderParticipant(order, user.id);

  const message = await p2pOrderMessagesRepository.create({
    orderId,
    senderUserId: user.id,
    messageType: "USER",
    body: trimmed,
    metadata: { event: "order_message" },
    createdBy: user.id,
  });

  await notifyOrderEvent({ event: "order_message", order, actorId: user.id });
  return message;
};

export const markOrderPaid = async ({ user, orderId }) => {
  assertKycEligible(user);
  logP2pEvent("p2p_order_mark_paid_attempt", { userId: user.id, orderId });

  const updated = await withTransaction(async (db) => {
    const order = await p2pOrdersRepository.findByIdForUpdate(orderId, db);
    if (!order || (order.buyerUserId !== user.id && order.sellerUserId !== user.id)) {
      throw createError("Order not found.", 404, "P2P_ORDER_NOT_FOUND");
    }

    if (order.buyerUserId !== user.id) {
      throw createError("Only the buyer can mark payment as completed.", 403, "P2P_MARK_PAID_FORBIDDEN");
    }

    if (order.status !== ORDER_STATUSES.PENDING_PAYMENT) {
      throw createError("Order is not awaiting payment.", 409, "P2P_MARK_PAID_STATUS_INVALID");
    }

    if (isExpiredOrder(order)) {
      throw createError("Order has expired. You cannot mark payment now.", 409, "P2P_MARK_PAID_EXPIRED");
    }

    const next = await p2pOrdersRepository.setStatus(
      order.id,
      {
        status: ORDER_STATUSES.PAID,
        markedPaidAt: new Date().toISOString(),
        updatedBy: user.id,
      },
      db,
    );

    await createSystemMessage({
      orderId: order.id,
      body: "Buyer marked payment as completed.",
      metadata: { event: "order_paid" },
      db,
    });

    await auditLogsRepository.create(
      {
        action: "p2p_order_marked_paid",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "p2p_order",
        resourceId: order.id,
        metadata: {},
      },
      db,
    );

    return next;
  });

  await notifyOrderEvent({ event: "order_paid", order: updated, actorId: user.id });
  logP2pEvent("p2p_order_mark_paid_success", { userId: user.id, orderId });
  const hydrated = await p2pOrdersRepository.findByIdForParticipant(updated.id, user.id);
  return toOrderView(hydrated || updated, user.id);
};

export const releaseOrder = async ({ user, orderId }) => {
  assertKycEligible(user);
  logP2pEvent("p2p_order_release_attempt", { userId: user.id, orderId });

  const updated = await withTransaction(async (db) => {
    const order = await p2pOrdersRepository.findByIdForUpdate(orderId, db);
    if (!order || (order.buyerUserId !== user.id && order.sellerUserId !== user.id)) {
      throw createError("Order not found.", 404, "P2P_ORDER_NOT_FOUND");
    }

    if (order.sellerUserId !== user.id) {
      throw createError("Only the seller can release escrow.", 403, "P2P_RELEASE_FORBIDDEN");
    }

    if (order.status !== ORDER_STATUSES.PAID) {
      throw createError("Order must be in PAID state before release.", 409, "P2P_RELEASE_STATUS_INVALID");
    }

    const escrow = await p2pEscrowLocksRepository.findByOrderIdForUpdate(order.id, db);
    if (!escrow || escrow.status !== "LOCKED") {
      throw createError("Escrow lock is not available for release.", 409, "P2P_ESCROW_NOT_LOCKED");
    }

    await settleEscrowToBuyer({
      sellerUserId: order.sellerUserId,
      buyerUserId: order.buyerUserId,
      walletType: order.walletType,
      assetCode: order.assetCode,
      amount: Number(order.cryptoAmount),
      orderId: order.id,
      db,
    });

    await p2pEscrowLocksRepository.updateByOrderId(
      order.id,
      {
        status: "RELEASED",
        releasedAt: new Date().toISOString(),
        metadata: { event: "escrow_released" },
      },
      db,
    );

    const next = await p2pOrdersRepository.setStatus(
      order.id,
      {
        status: ORDER_STATUSES.RELEASED,
        releasedAt: new Date().toISOString(),
        updatedBy: user.id,
      },
      db,
    );

    await createSystemMessage({
      orderId: order.id,
      body: "Seller released escrow. Order completed successfully.",
      metadata: { event: "order_released" },
      db,
    });

    await auditLogsRepository.create(
      {
        action: "p2p_order_released",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "p2p_order",
        resourceId: order.id,
        metadata: {},
      },
      db,
    );

    return next;
  });

  await notifyOrderEvent({ event: "order_released", order: updated, actorId: user.id });
  logP2pEvent("p2p_order_release_success", { userId: user.id, orderId });
  const hydrated = await p2pOrdersRepository.findByIdForParticipant(updated.id, user.id);
  return toOrderView(hydrated || updated, user.id);
};

export const cancelOrder = async ({ user, orderId, reason }) => {
  assertKycEligible(user);
  logP2pEvent("p2p_order_cancel_attempt", { userId: user.id, orderId });

  const result = await withTransaction(async (db) => {
    const order = await p2pOrdersRepository.findByIdForUpdate(orderId, db);
    if (!order || (order.buyerUserId !== user.id && order.sellerUserId !== user.id)) {
      throw createError("Order not found.", 404, "P2P_ORDER_NOT_FOUND");
    }

    if (![ORDER_STATUSES.PENDING_PAYMENT].includes(order.status)) {
      throw createError("Only unpaid orders can be cancelled.", 409, "P2P_CANCEL_STATUS_INVALID");
    }

    const expired = isExpiredOrder(order);
    const nextStatus = expired ? ORDER_STATUSES.EXPIRED : ORDER_STATUSES.CANCELLED;
    const escrow = await p2pEscrowLocksRepository.findByOrderIdForUpdate(order.id, db);

    if (escrow?.status === "LOCKED") {
      await unlockSellerEscrow({
        sellerUserId: order.sellerUserId,
        walletType: order.walletType,
        assetCode: order.assetCode,
        amount: Number(order.cryptoAmount),
        orderId: order.id,
        db,
        reason: nextStatus === ORDER_STATUSES.EXPIRED ? "P2P order expired" : "P2P order cancelled",
      });

      await p2pEscrowLocksRepository.updateByOrderId(
        order.id,
        {
          status: "UNLOCKED",
          unlockedAt: new Date().toISOString(),
          metadata: { reason: nextStatus === ORDER_STATUSES.EXPIRED ? "expired" : "cancelled" },
        },
        db,
      );
    }

    await p2pOffersRepository.adjustRemainingQuantity(
      {
        offerId: order.offerId,
        deltaQuantity: Number(order.cryptoAmount),
        updatedBy: user.id,
      },
      db,
    );

    const next = await p2pOrdersRepository.setStatus(
      order.id,
      {
        status: nextStatus,
        cancelledAt: new Date().toISOString(),
        cancelReason: normalizeOptionalText(reason) || (expired ? "payment_window_expired" : "cancelled_by_user"),
        updatedBy: user.id,
      },
      db,
    );

    await createSystemMessage({
      orderId: order.id,
      body: nextStatus === ORDER_STATUSES.EXPIRED
        ? "Order expired because payment was not completed in time."
        : "Order was cancelled before payment completion.",
      metadata: { event: nextStatus === ORDER_STATUSES.EXPIRED ? "order_expired" : "order_cancelled" },
      db,
    });

    await auditLogsRepository.create(
      {
        action: nextStatus === ORDER_STATUSES.EXPIRED ? "p2p_order_expired" : "p2p_order_cancelled",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "p2p_order",
        resourceId: order.id,
        metadata: { reason: reason || null },
      },
      db,
    );

    return next;
  });

  await notifyOrderEvent({
    event: result.status === ORDER_STATUSES.EXPIRED ? "order_expired" : "order_cancelled",
    order: result,
    actorId: user.id,
  });
  logP2pEvent("p2p_order_cancel_success", { userId: user.id, orderId, status: result.status });

  const hydrated = await p2pOrdersRepository.findByIdForParticipant(result.id, user.id);
  return toOrderView(hydrated || result, user.id);
};

export const openDispute = async ({ user, orderId, reason }) => {
  assertKycEligible(user);
  logP2pEvent("p2p_order_dispute_attempt", { userId: user.id, orderId });

  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length < 5) {
    throw createError("Dispute reason must be at least 5 characters.", 400, "P2P_DISPUTE_REASON_INVALID");
  }

  const order = await withTransaction(async (db) => {
    const current = await p2pOrdersRepository.findByIdForUpdate(orderId, db);
    if (!current || (current.buyerUserId !== user.id && current.sellerUserId !== user.id)) {
      throw createError("Order not found.", 404, "P2P_ORDER_NOT_FOUND");
    }

    if (![ORDER_STATUSES.PAID, ORDER_STATUSES.RELEASED, ORDER_STATUSES.PENDING_PAYMENT].includes(current.status)) {
      throw createError("Dispute cannot be opened for this order status.", 409, "P2P_DISPUTE_STATUS_INVALID");
    }

    const existing = await p2pDisputesRepository.findByOrderId(current.id, db);
    if (existing) {
      throw createError("A dispute is already open for this order.", 409, "P2P_DISPUTE_ALREADY_OPEN");
    }

    await p2pDisputesRepository.create(
      {
        orderId: current.id,
        openedByUserId: user.id,
        reason: normalizedReason,
        status: "OPEN",
        metadata: {},
        createdBy: user.id,
        updatedBy: user.id,
      },
      db,
    );

    const next = await p2pOrdersRepository.setStatus(
      current.id,
      {
        status: ORDER_STATUSES.DISPUTED,
        disputeOpenedAt: new Date().toISOString(),
        updatedBy: user.id,
      },
      db,
    );

    await createSystemMessage({
      orderId: current.id,
      body: "A dispute has been opened for this order.",
      metadata: { event: "order_disputed" },
      db,
    });

    await auditLogsRepository.create(
      {
        action: "p2p_order_disputed",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "p2p_order",
        resourceId: current.id,
        metadata: { reason: normalizedReason },
      },
      db,
    );

    return next;
  });

  await notifyOrderEvent({ event: "order_disputed", order, actorId: user.id });
  logP2pEvent("p2p_order_dispute_success", { userId: user.id, orderId });
  const hydrated = await p2pOrdersRepository.findByIdForParticipant(order.id, user.id);
  return toOrderView(hydrated || order, user.id);
};

export const getOrderForAdminView = async ({ orderId }) => {
  const order = await p2pOrdersRepository.findById(orderId);
  if (!order) {
    throw createError("Order not found.", 404, "P2P_ORDER_NOT_FOUND");
  }

  const [messages, dispute] = await Promise.all([
    p2pOrderMessagesRepository.listByOrderId(order.id),
    p2pDisputesRepository.findByOrderId(order.id),
  ]);

  return {
    ...toOrderView(order, order.buyerUserId, messages, dispute),
    adminView: true,
  };
};

export const P2P_CONSTANTS = {
  ORDER_STATUSES,
  OFFER_STATUSES,
};
