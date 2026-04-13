const ICON_CDN_BASE =
  process.env.NEXT_PUBLIC_MARKET_ICON_BASE_URL ||
  "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color";

const ICON_ALIASES: Record<string, string> = {
  BCHABC: "bch",
  BCHSV: "bsv",
  MIOTA: "iota",
  BTTOLD: "btt",
  XBT: "btc",
};

const normalizeIconCode = (symbol: string) => {
  const normalized = String(symbol || "").toUpperCase();
  const mapped = ICON_ALIASES[normalized] || normalized;
  const cleaned = mapped.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned || "generic";
};

const withCode = (template: string, code: string) => template.replace("{code}", code);

const ICON_SOURCES = [
  `${ICON_CDN_BASE}/{code}.png`,
  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/{code}.png",
  "https://assets.coincap.io/assets/icons/{code}@2x.png",
  "https://cryptoicons.org/api/icon/{code}/200",
];

export const buildCryptoIconCandidates = (symbol: string, preferredUrl?: string | null) => {
  const code = normalizeIconCode(symbol);
  const candidates = [
    preferredUrl || "",
    ...ICON_SOURCES.map((template) => withCode(template, code)),
  ].filter(Boolean);

  return Array.from(new Set(candidates));
};

export const getCryptoIconFallbackLabel = (symbol: string) => {
  const cleaned = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 2) || "??";
};

