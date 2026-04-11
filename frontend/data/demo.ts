export type Market = {
  symbol: string;
  pair: string;
  lastPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quote: "USDT" | "BTC" | "ETH";
};

export const marketData: Market[] = [
  { symbol: "BTCUSDT", pair: "BTC/USDT", lastPrice: 68241.22, change24h: 1.7, high24h: 68990.44, low24h: 66410.33, volume24h: 84215.22, quote: "USDT" },
  { symbol: "ETHUSDT", pair: "ETH/USDT", lastPrice: 3528.1, change24h: 2.53, high24h: 3569.18, low24h: 3398.2, volume24h: 221411.82, quote: "USDT" },
  { symbol: "SOLUSDT", pair: "SOL/USDT", lastPrice: 171.55, change24h: 3.26, high24h: 173.2, low24h: 162.1, volume24h: 534118.54, quote: "USDT" },
  { symbol: "BNBUSDT", pair: "BNB/USDT", lastPrice: 612.41, change24h: -1.24, high24h: 624.4, low24h: 606.92, volume24h: 88431.5, quote: "USDT" },
  { symbol: "XRPUSDT", pair: "XRP/USDT", lastPrice: 0.634, change24h: 4.1, high24h: 0.642, low24h: 0.602, volume24h: 1425119.92, quote: "USDT" },
  { symbol: "ADAUSDT", pair: "ADA/USDT", lastPrice: 0.812, change24h: -2.29, high24h: 0.839, low24h: 0.801, volume24h: 980124.33, quote: "USDT" },
  { symbol: "ETHBTC", pair: "ETH/BTC", lastPrice: 0.0517, change24h: 0.65, high24h: 0.0524, low24h: 0.0509, volume24h: 22231.11, quote: "BTC" },
  { symbol: "SOLETH", pair: "SOL/ETH", lastPrice: 0.0488, change24h: -0.47, high24h: 0.0492, low24h: 0.0475, volume24h: 12098.33, quote: "ETH" },
];

export const tickerItems = [
  "BTC +1.70%",
  "ETH +2.53%",
  "SOL +3.26%",
  "BNB -1.24%",
  "Funding rates updated under live risk controls",
  "Institutional API sandbox live",
  "Risk disclosures updated",
];

export const featuredCoins = [
  { name: "Bitcoin", symbol: "BTC", blurb: "Digital reserve asset with deep liquidity." },
  { name: "Ethereum", symbol: "ETH", blurb: "Programmable finance infrastructure for Web3." },
  { name: "Solana", symbol: "SOL", blurb: "Fast settlement with low-latency trading activity." },
  { name: "Chainlink", symbol: "LINK", blurb: "Oracle network securing onchain data delivery." },
];

export const whyChooseUs = [
  { title: "Security by default", copy: "Multi-layer account controls, withdrawal reviews, device management, and visible risk controls." },
  { title: "Built for active traders", copy: "Fast execution surfaces, clear market depth, and professional workspace layouts across desktop and mobile." },
  { title: "Global-ready rails", copy: "Spot, earn, wallet tooling, and API-ready workflows designed for retail and institutional use cases." },
];

export const securityPillars = [
  "Two-factor authentication and anti-phishing code flows",
  "Role-based admin access and KYC review states",
  "Rate limiting, JWT rotation, and protected routes",
  "Clear compliance disclosures and jurisdiction controls",
];

export const stakingOffers = [
  { asset: "ETH", term: "Flexible", apy: "4.2%", min: "0.1 ETH" },
  { asset: "SOL", term: "30 Days", apy: "7.8%", min: "5 SOL" },
  { asset: "USDT", term: "60 Days", apy: "11.4%", min: "100 USDT" },
];

export const portfolioSeries = [
  { name: "Mon", value: 94800 },
  { name: "Tue", value: 96300 },
  { name: "Wed", value: 95820 },
  { name: "Thu", value: 98140 },
  { name: "Fri", value: 100240 },
  { name: "Sat", value: 99420 },
  { name: "Sun", value: 101860 },
];

export const balances = [
  { asset: "USDT", available: 18880.12, total: 24850.12, pnl: 0.4 },
  { asset: "BTC", available: 0.7462, total: 0.8462, pnl: 8.3 },
  { asset: "ETH", available: 6.182, total: 6.182, pnl: 12.1 },
  { asset: "SOL", available: 118.1, total: 122.4, pnl: 19.6 },
];

export const transactions = [
  { id: "tx-001", type: "Deposit", asset: "USDT", amount: "5,000", status: "Completed", date: "2026-04-05 12:42 UTC" },
  { id: "tx-002", type: "Withdrawal", asset: "BTC", amount: "0.05", status: "Under review", date: "2026-04-06 08:10 UTC" },
  { id: "tx-003", type: "Trade", asset: "SOL", amount: "25", status: "Filled", date: "2026-04-06 18:21 UTC" },
  { id: "tx-004", type: "Transfer", asset: "USDT", amount: "1,000", status: "Completed", date: "2026-04-07 03:02 UTC" },
];

export const orderBook = Array.from({ length: 10 }).map((_, index) => ({
  bid: 68240 - index * 8.12,
  ask: 68242 + index * 8.21,
  amount: 0.4 + index * 0.13,
}));

export const recentTrades = Array.from({ length: 12 }).map((_, index) => ({
  price: 68220 + index * 5,
  size: 0.01 + index * 0.02,
  side: index % 2 === 0 ? "Buy" : "Sell",
  time: `12:${(10 + index).toString().padStart(2, "0")}:2${index}`,
}));

export const announcements = [
  "MalachiteX is built for live operations with jurisdiction-aware onboarding, compliance controls, and protected trading workflows.",
  "Regulated provider integrations and risk policies are enforced by country and account tier.",
];

export const newsItems = [
  { title: "How institutions evaluate exchange security posture", category: "Insights" },
  { title: "Understanding proof-of-reserves, cold storage, and wallet operations", category: "Learn" },
  { title: "Risk-aware staking dashboards for modern crypto products", category: "Product" },
];

export const faqItems = [
  { q: "Is MalachiteX connected to real funds?", a: "MalachiteX is designed for live operations with provider abstraction and compliance controls. Activation depends on regulated integrations per jurisdiction." },
  { q: "Can I try trading logic?", a: "Yes. Spot trading interactions, order forms, wallet flows, and admin states are production-oriented and integration-ready." },
  { q: "Does the site support compliance flows?", a: "Yes. KYC, device security, anti-phishing, risk notices, and legal pages are included." },
];

export const feeRows = [
  { tier: "Standard", maker: "0.10%", taker: "0.10%" },
  { tier: "Pro", maker: "0.08%", taker: "0.09%" },
  { tier: "VIP", maker: "0.04%", taker: "0.06%" },
];

export const jobs = [
  { title: "Senior Product Designer", team: "Design", location: "Remote" },
  { title: "Exchange Backend Engineer", team: "Engineering", location: "Dubai" },
  { title: "Risk Operations Lead", team: "Compliance", location: "Singapore" },
];
