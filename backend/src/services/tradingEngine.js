import { v4 as uuid } from "uuid";
import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { conversionsRepository } from "../repositories/conversionsRepository.js";
import { marketsRepository } from "../repositories/marketsRepository.js";
import { orderBookRepository } from "../repositories/orderBookRepository.js";
import { ordersRepository } from "../repositories/ordersRepository.js";
import { tradesRepository } from "../repositories/tradesRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { walletsRepository } from "../repositories/walletsRepository.js";
import { env } from "../config/env.js";
import { consumeLockedBalance, creditWallet, debitWallet, releaseLockedBalance } from "./walletEngine.js";
import { toDecimal, toNumber } from "../utils/decimal.js";
import { jobQueue } from "../workers/jobQueue.js";

const round = (value, precision = 10) => toNumber(value, precision);
const OPEN_STATUSES = new Set(["open", "partially_filled"]);
const makerFeeRate = toDecimal(env.tradeMakerFeeBps).div(10000);
const takerFeeRate = toDecimal(env.tradeTakerFeeBps).div(10000);
const MATCHING_LOCK_NAMESPACE = "spot_match";

const countDecimals = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const source = String(value).toLowerCase();
  if (source.includes("e-")) {
    const [, exponent] = source.split("e-");
    return Number(exponent) || 0;
  }

  const segments = source.split(".");
  return segments[1]?.length || 0;
};

const assertPrecision = ({ value, precision, label }) => {
  if (countDecimals(value) > precision) {
    throw new Error(`${label} exceeds allowed precision of ${precision} decimals.`);
  }
};

const resolveMarket = async (symbol) => {
  const market = await marketsRepository.findBySymbol(symbol);
  return market || null;
};

const assertMarketTradable = (market) => {
  if (!market) {
    throw new Error("Trading pair is unavailable.");
  }

  if (!Number.isFinite(Number(market.lastPrice)) || Number(market.lastPrice) <= 0) {
    throw new Error("Trading pair is temporarily unavailable.");
  }

  if (market.metadata?.tradable === false) {
    throw new Error("Trading pair is not tradable.");
  }
};

const getRemainingQuantity = (order) => round(toDecimal(order.quantity).minus(toDecimal(order.filledQuantity || 0)));

const normalizeStatus = (status) => String(status || "").toLowerCase();

const normalizeSide = (side) => String(side || "").toLowerCase();

const normalizeOrderType = (orderType) => String(orderType || "").toLowerCase();

const acquireSymbolExecutionLock = async (symbol, db) => {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${MATCHING_LOCK_NAMESPACE}:${symbol}`]);
};

const normalizedQuantity = (market, quantity) => {
  assertPrecision({
    value: quantity,
    precision: Number(market.quantityPrecision || 8),
    label: "Quantity",
  });

  const normalizedQty = round(toDecimal(quantity), Number(market.quantityPrecision || 8));

  if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  return normalizedQty;
};

const assertMinOrderSize = (market, quantity) => {
  if (toDecimal(quantity).lessThan(toDecimal(market.minOrderSize || 0))) {
    throw new Error(`Minimum order size for ${market.symbol} is ${market.minOrderSize}.`);
  }
};

const assertTradingBounds = ({ quantity, notional }) => {
  if (env.tradeMaxOrderQty && toDecimal(quantity).greaterThan(env.tradeMaxOrderQty)) {
    throw new Error(`Order quantity exceeds the configured maximum (${env.tradeMaxOrderQty}).`);
  }

  if (toDecimal(notional).lessThan(env.tradeMinOrderNotional)) {
    throw new Error(`Order notional must be at least ${env.tradeMinOrderNotional}.`);
  }

  if (env.tradeMaxOrderNotional && toDecimal(notional).greaterThan(env.tradeMaxOrderNotional)) {
    throw new Error(`Order notional exceeds the configured maximum (${env.tradeMaxOrderNotional}).`);
  }
};

const estimateLimitNotional = (price, quantity) => round(toDecimal(price).mul(toDecimal(quantity)));

const computeFee = (notional, feeRate) => round(toDecimal(notional).mul(toDecimal(feeRate)));

const resolveOrderStatus = (filledQuantity, totalQuantity) => {
  const filled = toDecimal(filledQuantity);
  const total = toDecimal(totalQuantity);

  if (filled.lte(0)) {
    return "open";
  }

  if (filled.greaterThanOrEqualTo(total)) {
    return "filled";
  }

  return "partially_filled";
};

const quoteFromMarket = ({ market, side, quantity, orderType = "market", price }) => {
  const marketPrice = Number(market.lastPrice);
  const normalizedQty = normalizedQuantity(market, quantity);
  assertMinOrderSize(market, normalizedQty);

  if (orderType === "limit") {
    assertPrecision({
      value: price,
      precision: Number(market.pricePrecision || 8),
      label: "Price",
    });
  }

  const effectivePrice = orderType === "market" ? marketPrice : round(Number(price), Number(market.pricePrecision || 8));
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
    throw new Error("A valid price is required for this order type.");
  }

  const notional = round(toDecimal(effectivePrice).mul(toDecimal(normalizedQty)));
  assertTradingBounds({ quantity: normalizedQty, notional });

  const fee = computeFee(notional, takerFeeRate);

  const baseAsset = market.baseAsset;
  const quoteAsset = market.quoteAsset;
  const totalDebit = side === "buy" ? round(toDecimal(notional).plus(fee)) : normalizedQty;

  return {
    symbol: market.symbol,
    side,
    orderType,
    quantity: normalizedQty,
    price: round(effectivePrice, Number(market.pricePrecision || 8)),
    notional,
    fee,
    feeRate: Number(takerFeeRate),
    settlement: {
      debitAsset: side === "buy" ? quoteAsset : baseAsset,
      creditAsset: side === "buy" ? baseAsset : quoteAsset,
      debitAmount: totalDebit,
      creditAmount: side === "buy" ? normalizedQty : round(toDecimal(notional).minus(toDecimal(fee))),
    },
    generatedAt: new Date().toISOString(),
  };
};

const syncOrderBook = async (symbol, db) => {
  const best = await ordersRepository.getBestBidAsk(symbol, db);
  await orderBookRepository.upsertBestPrices(
    {
      symbol,
      bidPrice: best.bidPrice,
      askPrice: best.askPrice,
    },
    db,
  );
};

const getAggressivePriceLevels = async ({ symbol, side, db }) => {
  const opposingSide = side === "buy" ? "sell" : "buy";
  return ordersRepository.listOrderBookSide(
    {
      symbol,
      side: opposingSide,
      depth: 200,
    },
    db,
  );
};

const estimateMarketOrderReserve = async ({ symbol, side, quantity, marketFallbackPrice, db }) => {
  const levels = await getAggressivePriceLevels({ symbol, side, db });

  if (!levels.length) {
    if (side === "sell") {
      assertTradingBounds({
        quantity,
        notional: round(toDecimal(quantity).mul(toDecimal(marketFallbackPrice))),
      });

      return {
        reserveAmount: quantity,
        estimatedNotional: round(toDecimal(quantity).mul(toDecimal(marketFallbackPrice))),
        estimatedFillQuantity: 0,
      };
    }

    throw new Error("No opposite-side liquidity is currently available for this market order.");
  }

  let remaining = toDecimal(quantity);
  let estimatedNotional = toDecimal(0);
  let estimatedFillQuantity = toDecimal(0);

  for (const level of levels) {
    if (remaining.lte(0)) {
      break;
    }

    const levelQuantity = toDecimal(level.quantity);
    const tradable = remaining.lessThan(levelQuantity) ? remaining : levelQuantity;
    if (tradable.lte(0)) {
      continue;
    }

    estimatedFillQuantity = estimatedFillQuantity.plus(tradable);
    estimatedNotional = estimatedNotional.plus(tradable.mul(toDecimal(level.price)));
    remaining = remaining.minus(tradable);
  }

  const normalizedNotional = round(estimatedNotional);
  const normalizedQty = round(quantity);
  assertTradingBounds({ quantity: normalizedQty, notional: normalizedNotional });

  if (side === "sell") {
    return {
      reserveAmount: quantity,
      estimatedNotional: normalizedNotional,
      estimatedFillQuantity: round(estimatedFillQuantity),
    };
  }

  const reserveAmount = round(estimatedNotional.plus(toDecimal(computeFee(estimatedNotional, takerFeeRate))));
  return {
    reserveAmount,
    estimatedNotional: normalizedNotional,
    estimatedFillQuantity: round(estimatedFillQuantity),
  };
};

const ensureCrossingPrice = ({ incomingOrder, restingOrder }) => {
  if (incomingOrder.orderType !== "limit") {
    return true;
  }

  if (incomingOrder.side === "buy") {
    return Number(restingOrder.price) <= Number(incomingOrder.price);
  }

  return Number(restingOrder.price) >= Number(incomingOrder.price);
};

const settleTradeWallets = async ({ market, buyerOrder, sellerOrder, tradePrice, tradeQuantity, takerOrderId, matchId }, db) => {
  const tradeNotional = round(toDecimal(tradePrice).mul(toDecimal(tradeQuantity)));
  const buyerFeeRate = buyerOrder.id === takerOrderId ? takerFeeRate : makerFeeRate;
  const sellerFeeRate = sellerOrder.id === takerOrderId ? takerFeeRate : makerFeeRate;
  const buyerFee = computeFee(tradeNotional, buyerFeeRate);
  const sellerFee = computeFee(tradeNotional, sellerFeeRate);

  const buyerLockedSpend = round(toDecimal(tradeNotional).plus(toDecimal(buyerFee)));

  await consumeLockedBalance(
    {
      userId: buyerOrder.userId,
      walletType: buyerOrder.walletType,
      asset: market.quoteAsset,
      amount: buyerLockedSpend,
      referenceType: "spot_trade",
      referenceId: matchId,
      description: `Matched BUY ${market.symbol}`,
      idempotencyKey: `match_buy_debit_${matchId}`,
    },
    db,
  );

  await consumeLockedBalance(
    {
      userId: sellerOrder.userId,
      walletType: sellerOrder.walletType,
      asset: market.baseAsset,
      amount: tradeQuantity,
      referenceType: "spot_trade",
      referenceId: matchId,
      description: `Matched SELL ${market.symbol}`,
      idempotencyKey: `match_sell_debit_${matchId}`,
    },
    db,
  );

  await creditWallet(
    {
      userId: buyerOrder.userId,
      walletType: buyerOrder.walletType,
      asset: market.baseAsset,
      amount: tradeQuantity,
      referenceType: "spot_trade",
      referenceId: matchId,
      description: `Filled BUY ${market.symbol}`,
      idempotencyKey: `match_buy_credit_${matchId}`,
    },
    db,
  );

  await creditWallet(
    {
      userId: sellerOrder.userId,
      walletType: sellerOrder.walletType,
      asset: market.quoteAsset,
      amount: round(toDecimal(tradeNotional).minus(toDecimal(sellerFee))),
      referenceType: "spot_trade",
      referenceId: matchId,
      description: `Filled SELL ${market.symbol}`,
      idempotencyKey: `match_sell_credit_${matchId}`,
    },
    db,
  );

  return {
    tradeNotional,
    buyerFee,
    sellerFee,
    buyerFeeRate: Number(buyerFeeRate),
    sellerFeeRate: Number(sellerFeeRate),
    buyerLockedSpend,
    sellerLockedSpend: tradeQuantity,
    feeAsset: market.quoteAsset,
  };
};

const persistMatchTrades = async ({ symbol, tradePrice, tradeQuantity, tradeNotional, buyerFee, sellerFee, buyerFeeRate, sellerFeeRate, buyerOrder, sellerOrder, feeAsset, matchId, takerOrderId }, db) => {
  const common = {
    symbol,
    price: tradePrice,
    quantity: tradeQuantity,
    notional: tradeNotional,
    buyOrderId: buyerOrder.id,
    sellOrderId: sellerOrder.id,
    matchId,
  };

  await tradesRepository.create(
    {
      ...common,
      orderId: buyerOrder.id,
      userId: buyerOrder.userId,
      side: "buy",
      orderType: buyerOrder.orderType,
      fee: buyerFee,
      feeAsset,
      liquidityRole: buyerOrder.id === takerOrderId ? "taker" : "maker",
      settlementWalletType: buyerOrder.walletType,
      idempotencyKey: `trade_${matchId}_buy`,
      metadata: {
        role: "buyer",
        feeRate: buyerFeeRate,
      },
    },
    db,
  );

  await tradesRepository.create(
    {
      ...common,
      orderId: sellerOrder.id,
      userId: sellerOrder.userId,
      side: "sell",
      orderType: sellerOrder.orderType,
      fee: sellerFee,
      feeAsset,
      liquidityRole: sellerOrder.id === takerOrderId ? "taker" : "maker",
      settlementWalletType: sellerOrder.walletType,
      idempotencyKey: `trade_${matchId}_sell`,
      metadata: {
        role: "seller",
        feeRate: sellerFeeRate,
      },
    },
    db,
  );
};

const persistMatchWalletTransactions = async ({
  market,
  tradePrice,
  tradeQuantity,
  settlement,
  buyerOrder,
  sellerOrder,
  matchId,
  takerOrderId,
}, db) => {
  const [buyerWallet, sellerWallet] = await Promise.all([
    walletsRepository.findByUserTypeAsset(
      {
        userId: buyerOrder.userId,
        walletType: buyerOrder.walletType,
        asset: market.baseAsset,
      },
      db,
    ),
    walletsRepository.findByUserTypeAsset(
      {
        userId: sellerOrder.userId,
        walletType: sellerOrder.walletType,
        asset: market.quoteAsset,
      },
      db,
    ),
  ]);

  await walletTransactionsRepository.create(
    {
      userId: buyerOrder.userId,
      walletId: buyerWallet?.id || null,
      transactionType: "trade_buy",
      asset: market.baseAsset,
      walletType: buyerOrder.walletType,
      network: "internal",
      amount: tradeQuantity,
      fee: settlement.buyerFee,
      destinationAddress: `${market.symbol} matched buy`,
      status: "completed",
      riskScore: 1,
      idempotencyKey: `trade_wallet_buy_${matchId}_${buyerOrder.id}`,
      txHash: `trade_${matchId}_buy`,
      providerReference: matchId,
      completedAt: new Date().toISOString(),
      metadata: {
        symbol: market.symbol,
        matchId,
        side: "buy",
        price: tradePrice,
        notional: settlement.tradeNotional,
        feeAsset: market.quoteAsset,
        liquidityRole: buyerOrder.id === takerOrderId ? "taker" : "maker",
      },
    },
    db,
  );

  await walletTransactionsRepository.create(
    {
      userId: sellerOrder.userId,
      walletId: sellerWallet?.id || null,
      transactionType: "trade_sell",
      asset: market.quoteAsset,
      walletType: sellerOrder.walletType,
      network: "internal",
      amount: round(toDecimal(settlement.tradeNotional).minus(toDecimal(settlement.sellerFee))),
      fee: settlement.sellerFee,
      destinationAddress: `${market.symbol} matched sell`,
      status: "completed",
      riskScore: 1,
      idempotencyKey: `trade_wallet_sell_${matchId}_${sellerOrder.id}`,
      txHash: `trade_${matchId}_sell`,
      providerReference: matchId,
      completedAt: new Date().toISOString(),
      metadata: {
        symbol: market.symbol,
        matchId,
        side: "sell",
        price: tradePrice,
        quantity: tradeQuantity,
        notional: settlement.tradeNotional,
        feeAsset: market.quoteAsset,
        liquidityRole: sellerOrder.id === takerOrderId ? "taker" : "maker",
      },
    },
    db,
  );
};

const applyFill = async ({ order, fillQuantity, lockedConsumed }, db) => {
  const nextFilled = round(toDecimal(order.filledQuantity || 0).plus(toDecimal(fillQuantity)));
  const quantity = toDecimal(order.quantity);
  const nextStatus = resolveOrderStatus(nextFilled, quantity);
  const nextLockedAmountDecimal = toDecimal(order.lockedAmount || 0).minus(toDecimal(lockedConsumed));
  const nextLockedAmount = nextLockedAmountDecimal.lessThan(0) ? 0 : round(nextLockedAmountDecimal);

  const updated = await ordersRepository.updateProgress(
    {
      orderId: order.id,
      status: nextStatus,
      filledQuantity: nextFilled,
      lockedAmount: nextLockedAmount,
    },
    db,
  );

  return updated;
};

const releaseOrderRemainderIfNeeded = async ({ order, market }, db) => {
  if (Number(order.lockedAmount || 0) <= 0) {
    return order;
  }

  const reserveAsset = order.side === "buy" ? market.quoteAsset : market.baseAsset;
  await releaseLockedBalance(
    {
      userId: order.userId,
      walletType: order.walletType,
      asset: reserveAsset,
      amount: Number(order.lockedAmount),
      referenceType: "order_release",
      referenceId: order.id,
      description: "Unfilled order funds released",
      idempotencyKey: `release_${order.id}`,
    },
    db,
  );

  return ordersRepository.updateProgress(
    {
      orderId: order.id,
      status: normalizeStatus(order.status) === "filled" ? "filled" : "cancelled",
      filledQuantity: Number(order.filledQuantity || 0),
      lockedAmount: 0,
    },
    db,
  );
};

const runMatchingEngine = async ({ orderId, market }, db) => {
  let incoming = await ordersRepository.findByIdForUpdate(orderId, db);
  if (!incoming) {
    throw new Error("Order not found for matching.");
  }

  const executions = [];

  while (OPEN_STATUSES.has(normalizeStatus(incoming.status)) && getRemainingQuantity(incoming) > 0) {
    const matchCandidate = await ordersRepository.findBestMatchingOrder(
      {
        symbol: incoming.symbol,
        incomingSide: incoming.side,
        limitPrice: incoming.orderType === "limit" ? Number(incoming.price) : null,
        excludedUserId: incoming.userId,
      },
      db,
    );

    if (!matchCandidate) {
      break;
    }

    if (!ensureCrossingPrice({ incomingOrder: incoming, restingOrder: matchCandidate })) {
      break;
    }

    const incomingRemaining = toDecimal(getRemainingQuantity(incoming));
    const restingRemaining = toDecimal(getRemainingQuantity(matchCandidate));
    const tradeQuantity = round(
      incomingRemaining.lessThan(restingRemaining) ? incomingRemaining : restingRemaining,
      Number(market.quantityPrecision || 8),
    );

    if (tradeQuantity <= 0) {
      break;
    }

    const tradePrice = round(Number(matchCandidate.price), Number(market.pricePrecision || 8));
    const buyerOrder = normalizeSide(incoming.side) === "buy" ? incoming : matchCandidate;
    const sellerOrder = normalizeSide(incoming.side) === "sell" ? incoming : matchCandidate;
    const matchId = uuid();

    const settlement = await settleTradeWallets(
      {
        market,
        buyerOrder,
        sellerOrder,
        tradePrice,
        tradeQuantity,
        takerOrderId: incoming.id,
        matchId,
      },
      db,
    );

    incoming = await applyFill(
      {
        order: incoming,
        fillQuantity: tradeQuantity,
        lockedConsumed: incoming.side === "buy" ? settlement.buyerLockedSpend : settlement.sellerLockedSpend,
      },
      db,
    );

    let restingUpdated = await applyFill(
      {
        order: matchCandidate,
        fillQuantity: tradeQuantity,
        lockedConsumed: matchCandidate.side === "buy" ? settlement.buyerLockedSpend : settlement.sellerLockedSpend,
      },
      db,
    );

    if (normalizeStatus(restingUpdated.status) === "filled" && Number(restingUpdated.lockedAmount || 0) > 0) {
      restingUpdated = await releaseOrderRemainderIfNeeded({ order: restingUpdated, market }, db);
    }

    if (normalizeStatus(incoming.status) === "filled" && Number(incoming.lockedAmount || 0) > 0) {
      incoming = await releaseOrderRemainderIfNeeded({ order: incoming, market }, db);
    }

    await persistMatchTrades(
      {
        symbol: incoming.symbol,
        tradePrice,
        tradeQuantity,
        tradeNotional: settlement.tradeNotional,
        buyerFee: settlement.buyerFee,
        sellerFee: settlement.sellerFee,
        buyerFeeRate: settlement.buyerFeeRate,
        sellerFeeRate: settlement.sellerFeeRate,
        buyerOrder,
        sellerOrder,
        feeAsset: settlement.feeAsset,
        matchId,
        takerOrderId: incoming.id,
      },
      db,
    );

    await persistMatchWalletTransactions(
      {
        market,
        tradePrice,
        tradeQuantity,
        settlement,
        buyerOrder,
        sellerOrder,
        matchId,
        takerOrderId: incoming.id,
      },
      db,
    );

    await marketsRepository.updateBySymbol(
      incoming.symbol,
      {
        lastPrice: tradePrice,
      },
      db,
    );

    executions.push({
      matchId,
      price: tradePrice,
      quantity: tradeQuantity,
      notional: settlement.tradeNotional,
      buyerFee: settlement.buyerFee,
      sellerFee: settlement.sellerFee,
      feeAsset: settlement.feeAsset,
    });

    await auditLogsRepository.create(
      {
        action: "spot_order_matched",
        actorId: "system",
        actorRole: "system",
        resourceType: "order_match",
        resourceId: matchId,
        metadata: {
          symbol: incoming.symbol,
          buyOrderId: buyerOrder.id,
          sellOrderId: sellerOrder.id,
          price: tradePrice,
          quantity: tradeQuantity,
          takerOrderId: incoming.id,
        },
      },
      db,
    );
  }

  if (incoming.orderType === "market" && getRemainingQuantity(incoming) > 0) {
    incoming = await ordersRepository.updateProgress(
      {
        orderId: incoming.id,
        status: "cancelled",
        filledQuantity: Number(incoming.filledQuantity || 0),
        lockedAmount: Number(incoming.lockedAmount || 0),
      },
      db,
    );

    incoming = await releaseOrderRemainderIfNeeded({ order: incoming, market }, db);
  }

  await syncOrderBook(incoming.symbol, db);

  return {
    order: incoming,
    executions,
  };
};

export const createTradeQuote = async ({ symbol, side, quantity, orderType = "market", price }) => {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const market = await resolveMarket(normalizedSymbol);
  assertMarketTradable(market);

  return quoteFromMarket({
    market,
    side: normalizeSide(side),
    quantity,
    orderType: normalizeOrderType(orderType),
    price,
  });
};

export const placeSpotOrder = async ({ user, symbol, side, orderType, quantity, price, walletType = "spot" }) => {
  if (user.accountRestrictions?.tradingLocked) {
    throw new Error("Trading is temporarily restricted on this account.");
  }

  const market = await resolveMarket(symbol.toUpperCase());
  assertMarketTradable(market);

  const normalizedSide = normalizeSide(side);
  const normalizedOrderType = normalizeOrderType(orderType);
  const normalizedQty = normalizedQuantity(market, quantity);
  assertMinOrderSize(market, normalizedQty);

  if (!["buy", "sell"].includes(normalizedSide)) {
    throw new Error("Order side must be buy or sell.");
  }

  if (!["market", "limit"].includes(normalizedOrderType)) {
    throw new Error("Order type must be market or limit.");
  }

  if (normalizedOrderType === "limit") {
    assertPrecision({
      value: price,
      precision: Number(market.pricePrecision || 8),
      label: "Price",
    });
  }

  const normalizedPrice = normalizedOrderType === "limit" ? round(toDecimal(price), Number(market.pricePrecision || 8)) : null;
  if (normalizedOrderType === "limit" && (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0)) {
    throw new Error("A valid limit price is required.");
  }

  const baselineNotional = normalizedOrderType === "limit"
    ? estimateLimitNotional(normalizedPrice, normalizedQty)
    : round(toDecimal(normalizedQty).mul(toDecimal(market.lastPrice)));
  assertTradingBounds({ quantity: normalizedQty, notional: baselineNotional });

  const quote = quoteFromMarket({
    market,
    side: normalizedSide,
    quantity: normalizedQty,
    orderType: normalizedOrderType,
    price: normalizedPrice ?? Number(market.lastPrice),
  });

  return withTransaction(async (db) => {
    await acquireSymbolExecutionLock(market.symbol, db);

    const orderIdempotencyKey = `order_${user.id}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const reserveAsset = normalizedSide === "buy" ? market.quoteAsset : market.baseAsset;

    let reserveAmount = 0;
    let estimatedMarketNotional = quote.notional;

    if (normalizedSide === "buy" && normalizedOrderType === "limit") {
      const reserveNotional = estimateLimitNotional(normalizedPrice, normalizedQty);
      reserveAmount = round(toDecimal(reserveNotional).plus(toDecimal(computeFee(reserveNotional, takerFeeRate))));
    } else if (normalizedSide === "buy" && normalizedOrderType === "market") {
      const estimate = await estimateMarketOrderReserve({
        symbol: market.symbol,
        side: normalizedSide,
        quantity: normalizedQty,
        marketFallbackPrice: Number(market.lastPrice),
        db,
      });
      reserveAmount = estimate.reserveAmount;
      estimatedMarketNotional = estimate.estimatedNotional || quote.notional;
    } else {
      reserveAmount = normalizedQty;
    }

    if (!Number.isFinite(reserveAmount) || reserveAmount <= 0) {
      throw new Error("Unable to reserve funds for this order.");
    }

    await debitWallet(
      {
        userId: user.id,
        walletType,
        asset: reserveAsset,
        amount: reserveAmount,
        referenceType: "spot_order_lock",
        referenceId: orderIdempotencyKey,
        description: `${normalizedSide} ${market.symbol} order funds locked`,
        lockOnly: true,
        idempotencyKey: orderIdempotencyKey,
      },
      db,
    );

    const created = await ordersRepository.create(
      {
        userId: user.id,
        symbol: market.symbol,
        side: normalizedSide,
        orderType: normalizedOrderType,
        walletType,
        price: normalizedPrice,
        quantity: normalizedQty,
        filledQuantity: 0,
        notional: normalizedOrderType === "market" ? estimatedMarketNotional : estimateLimitNotional(normalizedPrice, normalizedQty),
        fee: normalizedOrderType === "market"
          ? computeFee(estimatedMarketNotional, takerFeeRate)
          : computeFee(estimateLimitNotional(normalizedPrice, normalizedQty), takerFeeRate),
        lockedAmount: reserveAmount,
        status: "open",
        idempotencyKey: orderIdempotencyKey,
        metadata: {},
      },
      db,
    );

    const matched = await runMatchingEngine(
      {
        orderId: created.id,
        market,
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "spot_order_placed",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "order",
        resourceId: created.id,
        metadata: {
          symbol: market.symbol,
          side: normalizedSide,
          orderType: normalizedOrderType,
          status: matched.order.status,
          fills: matched.executions.length,
        },
      },
      db,
    );

    await jobQueue.publish(
      "trading.order.placed",
      {
        userId: user.id,
        orderId: created.id,
        symbol: market.symbol,
        status: matched.order.status,
      },
      db,
    );

    return {
      order: {
        id: matched.order.id,
        symbol: matched.order.symbol,
        side: matched.order.side,
        orderType: matched.order.orderType,
        walletType: matched.order.walletType,
        price: matched.order.price != null ? Number(matched.order.price) : null,
        quantity: Number(matched.order.quantity),
        filledQuantity: Number(matched.order.filledQuantity || 0),
        notional: Number(matched.order.notional),
        fee: Number(matched.order.fee),
        lockedAmount: Number(matched.order.lockedAmount || 0),
        status: matched.order.status,
        createdAt: matched.order.createdAt,
        updatedAt: matched.order.updatedAt,
      },
      quote,
      executions: matched.executions,
    };
  });
};

export const cancelSpotOrder = async ({ user, orderId }) => {
  return withTransaction(async (db) => {
    const existingOrder = await ordersRepository.findByIdForUser(orderId, user.id, db);

    if (!existingOrder) {
      throw new Error("Open or partially filled order not found.");
    }

    const market = await resolveMarket(existingOrder.symbol);

    if (!market) {
      throw new Error("Market pair not found for this order.");
    }

    await acquireSymbolExecutionLock(existingOrder.symbol, db);

    const order = await ordersRepository.findByIdForUserForUpdate(orderId, user.id, db);

    if (!order || !OPEN_STATUSES.has(normalizeStatus(order.status))) {
      throw new Error("Open or partially filled order not found.");
    }

    const idempotencyKey = `cancel_${order.id}`;
    const amountToRelease = Number(order.lockedAmount || 0);

    if (amountToRelease > 0 && order.side === "buy") {
      await releaseLockedBalance(
        {
          userId: user.id,
          walletType: order.walletType,
          asset: market.quoteAsset,
          amount: amountToRelease,
          referenceType: "order_cancel",
          referenceId: order.id,
          description: "Locked quote asset released after cancellation",
          idempotencyKey,
        },
        db,
      );
    } else if (amountToRelease > 0) {
      await releaseLockedBalance(
        {
          userId: user.id,
          walletType: order.walletType,
          asset: market.baseAsset,
          amount: amountToRelease,
          referenceType: "order_cancel",
          referenceId: order.id,
          description: "Locked base asset released after cancellation",
          idempotencyKey,
        },
        db,
      );
    }

    const updated = await ordersRepository.updateProgress(
      {
        orderId: order.id,
        status: "cancelled",
        filledQuantity: Number(order.filledQuantity || 0),
        lockedAmount: 0,
      },
      db,
    );

    await syncOrderBook(order.symbol, db);

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
      price: updated.price != null ? Number(updated.price) : null,
      quantity: Number(updated.quantity),
      filledQuantity: Number(updated.filledQuantity || 0),
      notional: Number(updated.notional),
      fee: Number(updated.fee),
      lockedAmount: Number(updated.lockedAmount || 0),
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
    price: order.price != null ? Number(order.price) : null,
    quantity: Number(order.quantity),
    filledQuantity: Number(order.filledQuantity || 0),
    remainingQuantity: round(toDecimal(order.quantity).minus(toDecimal(order.filledQuantity || 0))),
    notional: Number(order.notional),
    fee: Number(order.fee),
    lockedAmount: Number(order.lockedAmount || 0),
    status: order.status,
    createdAt: order.createdAt,
  }));
};

export const listUserOrders = async (userId) => {
  const orders = await ordersRepository.listByUser(userId, 100);

  return orders.map((order) => ({
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    orderType: order.orderType,
    walletType: order.walletType,
    price: order.price != null ? Number(order.price) : null,
    quantity: Number(order.quantity),
    filledQuantity: Number(order.filledQuantity || 0),
    remainingQuantity: round(toDecimal(order.quantity).minus(toDecimal(order.filledQuantity || 0))),
    notional: Number(order.notional),
    fee: Number(order.fee),
    lockedAmount: Number(order.lockedAmount || 0),
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
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
    feeAsset: trade.feeAsset || null,
    liquidityRole: trade.liquidityRole || null,
    settlementWalletType: trade.settlementWalletType,
    time: trade.createdAt,
  }));
};

export const getOrderBook = async (symbol, depth = 20) => {
  const market = await resolveMarket(symbol.toUpperCase());
  assertMarketTradable(market);

  const [bids, asks, recentTrades, best] = await Promise.all([
    ordersRepository.listOrderBookSide({ symbol: market.symbol, side: "buy", depth }),
    ordersRepository.listOrderBookSide({ symbol: market.symbol, side: "sell", depth }),
    tradesRepository.listRecentBySymbol(market.symbol, Math.max(depth, 20)),
    ordersRepository.getBestBidAsk(market.symbol),
  ]);

  return {
    symbol: market.symbol,
    bids,
    asks,
    bestBid: best.bidPrice,
    bestAsk: best.askPrice,
    spread:
      best.bidPrice != null && best.askPrice != null
        ? round(toDecimal(best.askPrice).minus(toDecimal(best.bidPrice)), Number(market.pricePrecision || 8))
        : null,
    recentTrades: recentTrades.map((item) => ({
      id: item.id,
      matchId: item.matchId || item.id,
      price: Number(item.price),
      quantity: Number(item.quantity),
      notional: Number(item.notional),
      side: item.side,
      time: item.createdAt,
    })),
    updatedAt: new Date().toISOString(),
  };
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
    const fee = computeFee(normalizedAmount, takerFeeRate);

    let targetAmount;

    if (market.symbol === `${toAsset}${fromAsset}`) {
      targetAmount = round(toDecimal(normalizedAmount).minus(toDecimal(fee)).div(toDecimal(marketPrice)));
    } else {
      targetAmount = round(toDecimal(normalizedAmount).minus(toDecimal(fee)).mul(toDecimal(marketPrice)));
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
        feeAsset: fromAsset,
        liquidityRole: "taker",
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
