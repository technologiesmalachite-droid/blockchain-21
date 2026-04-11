import { v4 as uuid } from "uuid";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { conversionsRepository } from "../repositories/conversionsRepository.js";
import { marketsRepository } from "../repositories/marketsRepository.js";
import { ordersRepository } from "../repositories/ordersRepository.js";
import { tradesRepository } from "../repositories/tradesRepository.js";
import { creditWallet, debitWallet, releaseLockedBalance } from "./walletEngine.js";
import { jobQueue } from "../workers/jobQueue.js";

const FEE_RATE = 0.001;
const round = (value, precision = 10) => Number(Number(value).toFixed(precision));

const resolveMarket = async (symbol) => {
  const market = await marketsRepository.findBySymbol(symbol);
  return market || null;
};

const quoteFromMarket = ({ market, symbol, side, quantity, orderType = "market", price }) => {
  const marketPrice = Number(market.lastPrice);
  const effectivePrice = orderType === "market" ? marketPrice : price;

  if (!effectivePrice || effectivePrice <= 0) {
    throw new Error("A valid price is required for this order type.");
  }

  const normalizedQty = round(quantity, Number(market.quantityPrecision || 8));

  if (normalizedQty < Number(market.minOrderSize)) {
    throw new Error(`Minimum order size for ${symbol} is ${market.minOrderSize}.`);
  }

  const notional = round(effectivePrice * normalizedQty);
  const fee = round(notional * FEE_RATE);

  const baseAsset = market.baseAsset;
  const quoteAsset = market.quoteAsset;
  const totalDebit = side === "buy" ? round(notional + fee) : normalizedQty;

  return {
    symbol: market.symbol,
    side,
    orderType,
    quantity: normalizedQty,
    price: round(effectivePrice, Number(market.pricePrecision || 8)),
    notional,
    fee,
    feeRate: FEE_RATE,
    settlement: {
      debitAsset: side === "buy" ? quoteAsset : baseAsset,
      creditAsset: side === "buy" ? baseAsset : quoteAsset,
      debitAmount: totalDebit,
      creditAmount: side === "buy" ? normalizedQty : round(notional - fee),
    },
    generatedAt: new Date().toISOString(),
  };
};

export const createTradeQuote = async ({ symbol, side, quantity, orderType = "market", price }) => {
  const market = await resolveMarket(symbol.toUpperCase());

  if (!market) {
    throw new Error("Trading pair is unavailable.");
  }

  return quoteFromMarket({
    market,
    symbol: market.symbol,
    side,
    quantity,
    orderType,
    price,
  });
};

export const placeSpotOrder = async ({ user, symbol, side, orderType, quantity, price, walletType = "spot" }) => {
  if (user.accountRestrictions?.tradingLocked) {
    throw new Error("Trading is temporarily restricted on this account.");
  }

  const market = await resolveMarket(symbol.toUpperCase());

  if (!market) {
    throw new Error("Trading pair is unavailable.");
  }

  const quote = quoteFromMarket({
    market,
    symbol: market.symbol,
    side,
    quantity,
    orderType,
    price,
  });

  const isMarket = orderType === "market";

  return withTransaction(async (db) => {
    const orderIdempotencyKey = `order_${user.id}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    if (side === "buy") {
      await debitWallet(
        {
          userId: user.id,
          walletType,
          asset: quote.settlement.debitAsset,
          amount: quote.settlement.debitAmount,
          referenceType: "spot_order",
          referenceId: orderIdempotencyKey,
          description: `${side} ${quote.symbol} order placement`,
          lockOnly: !isMarket,
          idempotencyKey: orderIdempotencyKey,
        },
        db,
      );

      if (isMarket) {
        await creditWallet(
          {
            userId: user.id,
            walletType,
            asset: quote.settlement.creditAsset,
            amount: quote.settlement.creditAmount,
            referenceType: "spot_trade",
            referenceId: orderIdempotencyKey,
            description: `${side} ${quote.symbol} fill`,
            idempotencyKey: orderIdempotencyKey,
          },
          db,
        );
      }
    }

    if (side === "sell") {
      await debitWallet(
        {
          userId: user.id,
          walletType,
          asset: quote.settlement.debitAsset,
          amount: quote.settlement.debitAmount,
          referenceType: "spot_order",
          referenceId: orderIdempotencyKey,
          description: `${side} ${quote.symbol} order placement`,
          lockOnly: !isMarket,
          idempotencyKey: orderIdempotencyKey,
        },
        db,
      );

      if (isMarket) {
        await creditWallet(
          {
            userId: user.id,
            walletType,
            asset: quote.settlement.creditAsset,
            amount: quote.settlement.creditAmount,
            referenceType: "spot_trade",
            referenceId: orderIdempotencyKey,
            description: `${side} ${quote.symbol} fill proceeds`,
            idempotencyKey: orderIdempotencyKey,
          },
          db,
        );
      }
    }

    const order = await ordersRepository.create(
      {
        userId: user.id,
        symbol: quote.symbol,
        side,
        orderType,
        walletType,
        price: quote.price,
        quantity: quote.quantity,
        notional: quote.notional,
        fee: quote.fee,
        status: isMarket ? "filled" : "open",
        idempotencyKey: orderIdempotencyKey,
        metadata: {},
      },
      db,
    );

    if (order.status === "filled") {
      await tradesRepository.create(
        {
          orderId: order.id,
          userId: user.id,
          symbol: order.symbol,
          side,
          orderType,
          price: order.price,
          quantity: order.quantity,
          notional: order.notional,
          fee: order.fee,
          settlementWalletType: walletType,
          idempotencyKey: `trade_${order.id}`,
          metadata: {},
        },
        db,
      );
    }

    await auditLogsRepository.create(
      {
        action: "spot_order_placed",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "order",
        resourceId: order.id,
        metadata: {
          symbol: order.symbol,
          side: order.side,
          orderType: order.orderType,
          status: order.status,
        },
      },
      db,
    );

    await jobQueue.publish(
      "trading.order.placed",
      {
        userId: user.id,
        orderId: order.id,
        symbol: order.symbol,
        status: order.status,
      },
      db,
    );

    return {
      order: {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        walletType: order.walletType,
        price: Number(order.price),
        quantity: Number(order.quantity),
        notional: Number(order.notional),
        fee: Number(order.fee),
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      quote,
    };
  });
};

export const cancelSpotOrder = async ({ user, orderId }) => {
  return withTransaction(async (db) => {
    const order = await ordersRepository.findByIdForUserForUpdate(orderId, user.id, db);

    if (!order || order.status !== "open") {
      throw new Error("Open order not found.");
    }

    const market = await resolveMarket(order.symbol);

    if (!market) {
      throw new Error("Market pair not found for this order.");
    }

    const idempotencyKey = `cancel_${order.id}`;

    if (order.side === "buy") {
      await releaseLockedBalance(
        {
          userId: user.id,
          walletType: order.walletType,
          asset: market.quoteAsset,
          amount: Number(order.notional) + Number(order.fee),
          referenceType: "order_cancel",
          referenceId: order.id,
          description: "Locked quote asset released after cancellation",
          idempotencyKey,
        },
        db,
      );
    } else {
      await releaseLockedBalance(
        {
          userId: user.id,
          walletType: order.walletType,
          asset: market.baseAsset,
          amount: Number(order.quantity),
          referenceType: "order_cancel",
          referenceId: order.id,
          description: "Locked base asset released after cancellation",
          idempotencyKey,
        },
        db,
      );
    }

    const updated = await ordersRepository.updateStatus(order.id, "cancelled", db);

    await auditLogsRepository.create(
      {
        action: "spot_order_cancelled",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "order",
        resourceId: order.id,
        metadata: {
          symbol: order.symbol,
          side: order.side,
        },
      },
      db,
    );

    await jobQueue.publish(
      "trading.order.cancelled",
      {
        userId: user.id,
        orderId: order.id,
      },
      db,
    );

    return {
      id: updated.id,
      symbol: updated.symbol,
      side: updated.side,
      orderType: updated.orderType,
      walletType: updated.walletType,
      price: Number(updated.price),
      quantity: Number(updated.quantity),
      notional: Number(updated.notional),
      fee: Number(updated.fee),
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });
};

export const listOpenOrders = async (userId) => {
  const orders = await ordersRepository.listOpenByUser(userId);

  return orders.map((order) => ({
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    orderType: order.orderType,
    walletType: order.walletType,
    price: Number(order.price),
    quantity: Number(order.quantity),
    notional: Number(order.notional),
    fee: Number(order.fee),
    status: order.status,
    createdAt: order.createdAt,
  }));
};

export const listTradeHistory = async (userId) => {
  const trades = await tradesRepository.listByUser(userId);

  return trades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    orderType: trade.orderType,
    price: Number(trade.price),
    quantity: Number(trade.quantity),
    notional: Number(trade.notional),
    fee: Number(trade.fee),
    settlementWalletType: trade.settlementWalletType,
    time: trade.createdAt,
  }));
};

export const convertAsset = async ({ user, fromAsset, toAsset, amount, walletType = "spot" }) => {
  if (fromAsset === toAsset) {
    throw new Error("Conversion source and destination asset must be different.");
  }

  const market =
    (await resolveMarket(`${toAsset}${fromAsset}`)) ||
    (await resolveMarket(`${fromAsset}${toAsset}`));

  if (!market) {
    throw new Error("Conversion pair is currently unavailable.");
  }

  return withTransaction(async (db) => {
    const marketPrice = Number(market.lastPrice);
    const normalizedAmount = round(amount);
    const fee = round(normalizedAmount * FEE_RATE);

    let targetAmount;

    if (market.symbol === `${toAsset}${fromAsset}`) {
      targetAmount = round((normalizedAmount - fee) / marketPrice);
    } else {
      targetAmount = round((normalizedAmount - fee) * marketPrice);
    }

    const conversionId = uuid();
    const idempotencyKey = `convert_${conversionId}`;

    await debitWallet(
      {
        userId: user.id,
        walletType,
        asset: fromAsset,
        amount: normalizedAmount,
        referenceType: "convert",
        referenceId: conversionId,
        description: `Convert ${fromAsset} to ${toAsset}`,
        idempotencyKey,
      },
      db,
    );

    await creditWallet(
      {
        userId: user.id,
        walletType,
        asset: toAsset,
        amount: targetAmount,
        referenceType: "convert",
        referenceId: conversionId,
        description: `Receive ${toAsset} from conversion`,
        idempotencyKey,
      },
      db,
    );

    await conversionsRepository.create(
      {
        userId: user.id,
        fromAsset,
        toAsset,
        walletType,
        sourceAmount: normalizedAmount,
        receivedAmount: targetAmount,
        price: marketPrice,
        fee,
        idempotencyKey,
        metadata: {
          symbol: market.symbol,
        },
      },
      db,
    );

    const trade = await tradesRepository.create(
      {
        orderId: null,
        userId: user.id,
        symbol: `${fromAsset}/${toAsset}`,
        side: "convert",
        orderType: "convert",
        price: marketPrice,
        quantity: normalizedAmount,
        notional: targetAmount,
        fee,
        settlementWalletType: walletType,
        idempotencyKey,
        metadata: {
          converted: true,
        },
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "asset_converted",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "trade",
        resourceId: trade.id,
        metadata: {
          fromAsset,
          toAsset,
          amount: normalizedAmount,
          received: targetAmount,
        },
      },
      db,
    );

    await jobQueue.publish(
      "trading.asset.converted",
      {
        userId: user.id,
        tradeId: trade.id,
        fromAsset,
        toAsset,
      },
      db,
    );

    return {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      orderType: trade.orderType,
      price: Number(trade.price),
      quantity: Number(trade.quantity),
      notional: Number(trade.notional),
      fee: Number(trade.fee),
      settlementWalletType: trade.settlementWalletType,
      time: trade.createdAt,
    };
  });
};
