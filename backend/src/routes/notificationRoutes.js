import { Router } from "express";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import {
  markNotificationSchema,
  notificationsQuerySchema,
} from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireAuth, requireActiveAccount, requireConsents, validate(notificationsQuerySchema), asyncHandler(getNotifications));
router.post("/read-all", requireAuth, requireActiveAccount, requireConsents, asyncHandler(markAllNotificationsRead));
router.post("/:id/read", requireAuth, requireActiveAccount, requireConsents, validate(markNotificationSchema), asyncHandler(markNotificationRead));

export default router;

