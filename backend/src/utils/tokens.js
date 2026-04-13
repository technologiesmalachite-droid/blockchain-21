import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const weakSecretValues = new Set([
  "replace_with_secure_jwt_secret",
  "replace_with_secure_refresh_secret",
]);

const assertTokenSecret = (secret, name) => {
  if (typeof secret !== "string" || secret.trim().length === 0) {
    const error = new Error(`${name} is not configured.`);
    error.code = "CONFIG_SECRET_INVALID";
    throw error;
  }

  if (env.nodeEnv === "production" && weakSecretValues.has(secret)) {
    const error = new Error(`${name} is using an insecure placeholder value.`);
    error.code = "CONFIG_SECRET_INVALID";
    throw error;
  }
};

export const signAccessToken = (user) => {
  assertTokenSecret(env.jwtSecret, "JWT_SECRET");
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwtSecret, { expiresIn: "15m" });
};

export const signRefreshToken = (user) => {
  assertTokenSecret(env.jwtRefreshSecret, "JWT_REFRESH_SECRET");
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtRefreshSecret, { expiresIn: "7d" });
};

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);
