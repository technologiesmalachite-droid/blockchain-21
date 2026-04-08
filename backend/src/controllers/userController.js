import { sanitizeUser } from "../services/userService.js";

export const getProfile = (req, res) => res.json({ user: sanitizeUser(req.user) });

export const updateProfile = (req, res) => {
  req.user.fullName = req.validated.body.fullName;
  req.user.country = req.validated.body.country;
  req.user.antiPhishingCode = req.validated.body.antiPhishingCode || req.user.antiPhishingCode;
  return res.json({ user: sanitizeUser(req.user), message: "Profile updated." });
};

