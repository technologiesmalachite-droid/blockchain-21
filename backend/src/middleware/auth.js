import { usersRepository } from "../repositories/usersRepository.js";
import { verifyAccessToken } from "../utils/tokens.js";

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await usersRepository.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "User session is invalid." });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Access token expired or invalid." });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource." });
  }

  return next();
};
