import { verifyAccessToken } from "../utils/tokens.js";
import { db } from "../services/demoDb.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = db.users.find((entry) => entry.id === decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "User session is invalid." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Access token expired or invalid." });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ message: "You do not have permission to access this resource." });
  }

  next();
};

