const BINANCE_API_BASE = "https://api.binance.com/api/v3";
const ALLOWED_QUOTES = new Set(["USDT", "BTC", "ETH", "BNB", "FDUSD", "TRY", "EUR", "BRL"]);
const ICON_CDN_BASE =
  process.env.BINANCE_MARKET_ICON_BASE_URL || "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color";
const CACHE_TTL_MS = Number(process.env.BINANCE_MARKETS_CACHE_TTL_MS || 30_000);
const STALE_TTL_MS = Number(process.env.BINANCE_MARKETS_STALE_TTL_MS || 5 * 60_000);
const REQUEST_TIMEOUT_MS = Number(process.env.BINANCE_MARKETS_TIMEOUT_MS || 8_000);
const RETRY_COUNT = Number(process.env.BINANCE_MARKETS_RETRIES || 2);
const RETRY_DELAY_MS = Number(process.env.BINANCE_MARKETS_RETRY_DELAY_MS || 350);

const ICON_ALIASES = {
  BCHABC: "bch",
  BCHSV: "bsv",
  MIOTA: "iota",
  BTTOLD: "btt",
  XBT: "btc",
};

let snapshotCache = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeIconCode = (baseAsset) => {
  const normalized = String(baseAsset || "").toUpperCase();
  const mapped = ICON_ALIASES[normalized] || normalized;
  const cleaned = mapped.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned || "generic";
};

const buildFallbackImage = (baseAsset) => `${ICON_CDN_BASE}/${normalizeIconCode(baseAsset)}.png`;

const isSpotSymbol = (symbol) => {
  if (!symbol || symbol.status !== "TRADING") {
    return false;
  }

  const quoteAsset = typeof symbol.quoteAsset === "string" ? symbol.quoteAsset : "";
  if (!ALLOWED_QUOTES.has(quoteAsset)) {
    return false;
  }

  if (Array.isArray(symbol.permissions) && symbol.permissions.includes("SPOT")) {
    return true;
  }

  if (Array.isArray(symbol.permissionSets)) {
    return symbol.permissionSets.some((permissionSet) =>
      Array.isArray(permissionSet) ? permissionSet.includes("SPOT") : permissionSet === "SPOT",
    );
  }

  return symbol.isSpotTradingAllowed === true;
};

const parseFilters = (rawFilters) => {
  const list = Array.isArray(rawFilters) ? rawFilters : [];
  const byType = new Map(list.map((item) => [item.filterType, item]));
  const priceFilter = byType.get("PRICE_FILTER");
  const lotSizeFilter = byType.get("LOT_SIZE");
  const minNotionalFilter = byType.get("MIN_NOTIONAL") || byType.get("NOTIONAL");

  return {
    tickSize: priceFilter?.tickSize ?? null,
    stepSize: lotSizeFilter?.stepSize ?? null,
    minNotional: minNotionalFilter?.minNotional ?? null,
  };
};

const fetchWithTimeoutAndRetry = async (path) => {
  const url = `${BINANCE_API_BASE}${path}`;
  let attempt = 0;
  let lastError = null;

  while (attempt <= RETRY_COUNT) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Binance API responded with ${response.status} for ${path}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= RETRY_COUNT;
      if (isLastAttempt) {
        throw lastError;
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }

    attempt += 1;
  }

  throw lastError || new Error(`Unknown Binance request failure for ${path}`);
};

const buildMarketSnapshot = async () => {
  const [exchangeInfo, tickers] = await Promise.all([
    fetchWithTimeoutAndRetry("/exchangeInfo"),
    fetchWithTimeoutAndRetry("/ticker/24hr"),
  ]);

  const tickerMap = new Map((Array.isArray(tickers) ? tickers : []).map((item) => [item.symbol, item]));
  const symbols = Array.isArray(exchangeInfo?.symbols) ? exchangeInfo.symbols : [];

  const items = symbols
    .filter(isSpotSymbol)
    .map((symbol) => {
      const ticker = tickerMap.get(symbol.symbol);
      if (!ticker) {
        return null;
      }

      const filters = parseFilters(symbol.filters);
      const lastPrice = toNumber(ticker.lastPrice);
      const priceChangePercent = toNumber(ticker.priceChangePercent);
      const highPrice = toNumber(ticker.highPrice);
      const lowPrice = toNumber(ticker.lowPrice);
      const quoteVolume = toNumber(ticker.quoteVolume);
      const baseVolume = toNumber(ticker.volume);

      return {
        id: symbol.symbol,
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        status: symbol.status,
        pricePrecision: toNumber(symbol.quotePrecision ?? symbol.quoteAssetPrecision, 8),
        quantityPrecision: toNumber(symbol.baseAssetPrecision, 8),
        filters,
        lastPrice,
        priceChangePercent,
        highPrice,
        lowPrice,
        volume: quoteVolume,
        baseVolume,
        image: buildFallbackImage(symbol.baseAsset),
        updatedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.volume - a.volume)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return {
    source: "binance",
    stale: false,
    staleReason: null,
    updatedAt: new Date().toISOString(),
    quoteAssets: Array.from(ALLOWED_QUOTES),
    items,
  };
};

const cacheSnapshot = (snapshot) => {
  const currentTime = Date.now();
  // Keep a short fresh window for normal requests and a longer stale window for graceful fallback.
  snapshotCache = {
    freshUntil: currentTime + CACHE_TTL_MS,
    staleUntil: currentTime + STALE_TTL_MS,
    value: snapshot,
  };
};

export const getBinanceMarketsSnapshot = async () => {
  const currentTime = Date.now();
  if (snapshotCache && snapshotCache.freshUntil > currentTime) {
    return snapshotCache.value;
  }

  try {
    const snapshot = await buildMarketSnapshot();
    cacheSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    console.error("Failed to refresh Binance market snapshot", {
      message: error?.message || "Unknown Binance error",
    });

    if (snapshotCache && snapshotCache.staleUntil > currentTime) {
      // Provider failed; return the last known snapshot so frontend state can remain stable.
      return {
        ...snapshotCache.value,
        stale: true,
        staleReason: "Live Binance data is temporarily unavailable. Showing recently cached markets.",
      };
    }

    throw error;
  }
};
