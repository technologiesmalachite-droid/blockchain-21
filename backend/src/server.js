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
import notificationRoutes from "./routes/notificationRoutes.js";
import p2pRoutes from "./routes/p2pRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import { secureErrorHandler } from "./middleware/security.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

const getDatabaseTarget = () => {
  if (!env.databaseUrl) {
    return { configured: false };
  }

  try {
    const parsed = new URL(env.databaseUrl);
    return {
      configured: true,
      host: parsed.hostname || null,
      port: parsed.port || "5432",
      database: (parsed.pathname || "").replace(/^\//, "") || null,
      sslMode: env.dbSslMode,
    };
  } catch {
    return { configured: true, parseError: true, sslMode: env.dbSslMode };
  }
};

app.get("/api/health", (req, res) => {
  console.info(`[health] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  res.status(200).json({ ok: true });
});

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
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer?.length ? buffer.toString("utf8") : "";
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use((error, _req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON body.",
      code: "invalid_json",
    });
  }

  return next(error);
});
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/p2p", p2pRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found." });
});

app.use(secureErrorHandler);

const logStartupDiagnostics = async () => {
  if (env.configurationWarnings.length > 0) {
    console.warn("Configuration warnings detected:", env.configurationWarnings);
  }

  console.info("Startup DB target:", getDatabaseTarget());

  try {
    await query("SELECT 1");
    console.info("Startup check: database connectivity confirmed.");
  } catch (error) {
    console.error("Startup check: database connectivity failed.", {
      code: error?.code ?? null,
      message: typeof error?.message === "string" ? error.message : "Unknown database error.",
    });

    if (env.nodeEnv === "production") {
      console.error("Production startup aborted: database connection is required.");
      process.exit(1);
    }
  }
};

const PORT = Number(process.env.PORT);
const HOST = "0.0.0.0";
const resolvedPort = Number.isFinite(PORT) && PORT > 0 ? PORT : Number(env.port || 5000);

app.listen(resolvedPort, HOST, () => {
  console.log(`[startup] process.env.PORT=${process.env.PORT ?? "undefined"} resolvedPort=${resolvedPort} host=${HOST}`);
  console.log(`MalachiteX API running on http://${HOST}:${resolvedPort}`);
  logStartupDiagnostics().catch((error) => {
    console.error("Startup diagnostics failed unexpectedly.", {
      message: typeof error?.message === "string" ? error.message : String(error),
    });
  });
});
