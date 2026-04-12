import { randomUUID } from "crypto";
import { env } from "../config/env.js";

const shouldLogRequest = (req) => req.originalUrl !== "/api/health";

export const attachRequestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};

export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    if (!shouldLogRequest(req)) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    if (env.nodeEnv === "production") {
      console.info(
        JSON.stringify({
          level: "info",
          event: "http_request",
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          ip: req.ip,
        }),
      );
      return;
    }

    console.info(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(2)}ms`,
    );
  });

  next();
};
