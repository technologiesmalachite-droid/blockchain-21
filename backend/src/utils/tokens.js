import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwtSecret, { expiresIn: "15m" });

export const signRefreshToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtRefreshSecret, { expiresIn: "7d" });

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);

