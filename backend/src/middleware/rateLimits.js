import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const jsonRateLimitHandler = (message) => (_req, res) =>
  res.status(429).json({
    message,
    code: "rate_limited",
  });

const userAwareKeyGenerator = (req, _res) => req.user?.id || req.ip;
const emailAndIpKeyGenerator = (req, _res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${req.ip}:${email || "unknown"}`;
};

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

export const authEmailOtpSendLimiter = rateLimit({
  windowMs: env.authEmailOtpRateLimitWindowMs,
  limit: env.authEmailOtpSendRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: emailAndIpKeyGenerator,
  handler: jsonRateLimitHandler("Too many OTP requests. Please try again later."),
});

export const authEmailOtpVerifyLimiter = rateLimit({
  windowMs: env.authEmailOtpRateLimitWindowMs,
  limit: env.authEmailOtpVerifyRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: emailAndIpKeyGenerator,
  handler: jsonRateLimitHandler("Too many attempts, try again later."),
});

export const twoFactorActionLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  limit: Math.max(10, env.authRateLimitMax),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many two-factor setup requests. Please try again later."),
});

export const twoFactorVerifyLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  limit: Math.max(10, env.authRateLimitMax),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many two-factor verification attempts. Please wait and try again."),
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

export const walletActionLimiter = rateLimit({
  windowMs: env.walletActionRateLimitWindowMs,
  limit: env.walletActionRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many wallet requests. Please wait and try again."),
});

export const walletWithdrawalLimiter = rateLimit({
  windowMs: env.walletWithdrawRateLimitWindowMs,
  limit: env.walletWithdrawRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many withdrawal requests. Please wait before retrying."),
});

export const walletSwapLimiter = rateLimit({
  windowMs: env.walletSwapRateLimitWindowMs,
  limit: env.walletSwapRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: userAwareKeyGenerator,
  handler: jsonRateLimitHandler("Too many swap requests. Please slow down and retry."),
});
