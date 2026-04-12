import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { query } from "./db/pool.js";
import { globalApiLimiter } from "./middleware/rateLimits.js";
import { attachRequestId, requestLogger } from "./middleware/requestLogger.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import marketRoutes from "./routes/marketRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import { secureErrorHandler } from "./middleware/security.js";

const app = express();
app.disable("x-powered-by");

const allowedOrigins = new Set(env.clientUrls);
const allowedOriginPatterns = env.clientUrlPatterns;

const matchesPattern = (origin, pattern) => {
  if (!pattern || !origin) {
    return false;
  }

  if (!pattern.includes("*")) {
    return origin === pattern;
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`, "i");
  return regex.test(origin);
};

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) => matchesPattern(origin, pattern));
};

app.use(helmet());
app.set("trust proxy", 1);
app.use(attachRequestId);
app.use(requestLogger);
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(globalApiLimiter);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  let database = "up";

  try {
    await query("SELECT 1");
  } catch {
    database = "down";
  }

  const status = database === "up" ? "ok" : "degraded";
  const statusCode = database === "up" ? 200 : 503;

  res.status(statusCode).json({
    status,
    service: "MalachiteX API",
    mode: "live-ready",
    timestamp: new Date().toISOString(),
    checks: {
      database,
    },
    cors: {
      exactOrigins: env.clientUrls,
      wildcardPatterns: env.clientUrlPatterns,
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found." });
});

app.use(secureErrorHandler);

app.listen(env.port, () => {
  console.log(`MalachiteX API running on http://localhost:${env.port}`);
});
