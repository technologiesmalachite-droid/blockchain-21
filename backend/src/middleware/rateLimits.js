import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const jsonRateLimitHandler = (message) => (_req, res) =>
  res.status(429).json({
    message,
    code: "rate_limited",
  });

const userAwareKeyGenerator = (req, _res) => req.user?.id || req.ip;

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

export const otpSendLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  limit: Math.max(5, Math.floor(env.authRateLimitMax / 2)),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: jsonRateLimitHandler("Too many OTP requests. Please wait before requesting another code."),
});

export const otpVerifyLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  limit: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: jsonRateLimitHandler("Too many OTP verification attempts. Please try again later."),
});

export const tradeOrderLimiter = rateLimit({
  windowMs: env.tradeOrderRateLimitWindowMs,
  limit: env.tradeOrderRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many trading actions. Please wait a moment before placing another order."),
});

export const tradeCancelLimiter = rateLimit({
  windowMs: env.tradeCancelRateLimitWindowMs,
  limit: env.tradeCancelRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many cancel requests. Please wait before trying again."),
});
