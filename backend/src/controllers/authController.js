import { v4 as uuid } from "uuid";
import { db } from "../services/demoDb.js";
import { authenticateUser, createUser, sanitizeUser } from "../services/userService.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

const respondWithSession = (res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  db.refreshTokens.push({
    id: uuid(),
    userId: user.id,
    token: refreshToken,
    createdAt: new Date().toISOString(),
  });

  return res.json({
    user: sanitizeUser(user),
    tokens: { accessToken, refreshToken },
  });
};

export const register = async (req, res) => {
  try {
    const user = await createUser(req.validated.body);
    return respondWithSession(res.status(201), user);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const user = await authenticateUser(req.validated.body);
    return respondWithSession(res, user);
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
};

export const logout = (req, res) => {
  const { refreshToken } = req.body;
  db.refreshTokens = db.refreshTokens.filter((item) => item.token !== refreshToken);
  return res.json({ message: "Logged out successfully." });
};

export const refresh = (req, res) => {
  try {
    const { refreshToken } = req.body;
    const stored = db.refreshTokens.find((item) => item.token === refreshToken);

    if (!stored) {
      return res.status(401).json({ message: "Refresh token not recognized." });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = db.users.find((entry) => entry.id === decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "User not found for this refresh token." });
    }

    return res.json({
      accessToken: signAccessToken(user),
    });
  } catch {
    return res.status(401).json({ message: "Refresh token expired or invalid." });
  }
};

