import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../../src/db/pool.js";
import { usersRepository } from "../../src/repositories/usersRepository.js";
import { walletsRepository } from "../../src/repositories/walletsRepository.js";
import {
  createOffer,
  createOrderFromOffer,
  createPaymentMethod,
  getOrderById,
  markOrderPaid,
  releaseOrder,
} from "../../src/services/p2pService.js";
import { createUserSeed, deleteUserCascade, hasDatabase } from "./_dbTestUtils.js";

const runIfDb = hasDatabase ? test : test.skip;

const createApprovedUser = async (overrides = {}) =>
  usersRepository.create(
    createUserSeed({
      kycStatus: "approved",
      emailVerified: true,
      phoneVerified: true,
      ...overrides,
    }),
  );

runIfDb("p2p order lifecycle locks, marks paid, and releases escrow", async (t) => {
  const seller = await createApprovedUser({
    email: `seller_${Date.now()}@example.com`,
    fullName: "Seller User",
  });
  const buyer = await createApprovedUser({
    email: `buyer_${Date.now()}@example.com`,
    fullName: "Buyer User",
  });

  t.after(async () => {
    await deleteUserCascade(seller.id);
    await deleteUserCascade(buyer.id);
  });

  const sellerWallet = await walletsRepository.create({
    userId: seller.id,
    walletType: "funding",
    asset: "USDT",
  });

  await query(
    `UPDATE wallets
     SET total_balance = 300, available_balance = 300, locked_balance = 0, updated_at = NOW()
     WHERE id = $1`,
    [sellerWallet.id],
  );

  const paymentMethod = await createPaymentMethod({
    user: seller,
    payload: {
      methodType: "bank_transfer",
      label: "HDFC",
      accountName: "Seller User",
      accountNumber: "123456789012",
    },
  });

  const offer = await createOffer({
    user: seller,
    payload: {
      tradeType: "sell",
      assetCode: "USDT",
      fiatCurrency: "INR",
      walletType: "funding",
      price: 100,
      totalQuantity: 100,
      minAmount: 100,
      maxAmount: 10000,
      paymentMethodIds: [paymentMethod.id],
      terms: "Pay within 15 minutes",
      autoCancelMinutes: 15,
    },
  });

  const createdOrder = await createOrderFromOffer({
    user: buyer,
    offerId: offer.id,
    payload: {
      fiatAmount: 5000,
      paymentMethodId: paymentMethod.id,
    },
  });

  assert.equal(createdOrder.status, "PENDING_PAYMENT");

  const sellerWalletAfterLock = await query(
    `SELECT available_balance, locked_balance
     FROM wallets
     WHERE user_id = $1
       AND wallet_type = 'funding'
       AND asset = 'USDT'`,
    [seller.id],
  );

  assert.equal(Number(sellerWalletAfterLock.rows[0].available_balance), 250);
  assert.equal(Number(sellerWalletAfterLock.rows[0].locked_balance), 50);

  const paidOrder = await markOrderPaid({
    user: buyer,
    orderId: createdOrder.id,
  });

  assert.equal(paidOrder.status, "PAID");

  const releasedOrder = await releaseOrder({
    user: seller,
    orderId: createdOrder.id,
  });

  assert.equal(releasedOrder.status, "RELEASED");

  const sellerWalletAfterRelease = await query(
    `SELECT total_balance, available_balance, locked_balance
     FROM wallets
     WHERE user_id = $1
       AND wallet_type = 'funding'
       AND asset = 'USDT'`,
    [seller.id],
  );

  assert.equal(Number(sellerWalletAfterRelease.rows[0].total_balance), 250);
  assert.equal(Number(sellerWalletAfterRelease.rows[0].available_balance), 250);
  assert.equal(Number(sellerWalletAfterRelease.rows[0].locked_balance), 0);

  const buyerWalletAfterRelease = await query(
    `SELECT total_balance, available_balance, locked_balance
     FROM wallets
     WHERE user_id = $1
       AND wallet_type = 'funding'
       AND asset = 'USDT'`,
    [buyer.id],
  );

  assert.equal(Number(buyerWalletAfterRelease.rows[0].total_balance), 50);
  assert.equal(Number(buyerWalletAfterRelease.rows[0].available_balance), 50);
  assert.equal(Number(buyerWalletAfterRelease.rows[0].locked_balance), 0);

  const orderWithMessages = await getOrderById({
    user: buyer,
    orderId: createdOrder.id,
  });

  assert.equal(orderWithMessages.status, "RELEASED");
  assert.ok((orderWithMessages.messages || []).length >= 3);
});

if (!hasDatabase) {
  test("p2p lifecycle tests skipped without DATABASE_URL", () => {
    assert.ok(true);
  });
}
