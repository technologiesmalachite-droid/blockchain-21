import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const jsonRateLimitHandler = (message) => (_req, res) =>
  res.status(429).json({
    message,
    code: "rate_limited",
  });

export const globalApiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many requests. Please wait a moment and try again."),
});

export const authAttemptLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  limit: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: jsonRateLimitHandler("Too many authentication attempts. Please wait a few minutes and try again."),
});
