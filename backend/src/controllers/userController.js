import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { sanitizeUser } from "../services/userService.js";

export const getProfile = (req, res) => res.json({ user: sanitizeUser(req.user) });

export const updateProfile = async (req, res) => {
  const updated = await usersRepository.updateById(req.user.id, {
    fullName: req.validated.body.fullName,
    countryCode: req.validated.body.countryCode,
    antiPhishingCode: req.validated.body.antiPhishingCode || req.user.antiPhishingCode,
  });

  await auditLogsRepository.create({
    action: "profile_updated",
    actorId: req.user.id,
    actorRole: req.user.role,
    resourceType: "user",
    resourceId: req.user.id,
    metadata: {
      countryCode: updated.countryCode,
      antiPhishingCodeSet: Boolean(updated.antiPhishingCode),
    },
  });

  return res.json({ user: sanitizeUser(updated), message: "Profile updated." });
};
