import { notificationsRepository } from "../repositories/notificationsRepository.js";
import { env } from "../config/env.js";

export const getNotifications = async (req, res) => {
  const requestedPageSize = Number(req.validated?.query?.pageSize);
  const safePageSize = Number.isFinite(requestedPageSize)
    ? Math.min(env.notificationsMaxPageSize, Math.max(1, requestedPageSize))
    : env.notificationsDefaultPageSize;

  const result = await notificationsRepository.listByUser({
    userId: req.user.id,
    unreadOnly: req.validated?.query?.unreadOnly === "true" || req.validated?.query?.unreadOnly === true,
    page: req.validated?.query?.page,
    pageSize: safePageSize,
  });

  return res.json(result);
};

export const markNotificationRead = async (req, res) => {
  const notification = await notificationsRepository.markRead({
    userId: req.user.id,
    notificationId: req.validated.params.id,
  });

  if (!notification) {
    return res.status(404).json({ message: "Notification not found." });
  }

  return res.json({ notification, message: "Notification marked as read." });
};

export const markAllNotificationsRead = async (req, res) => {
  await notificationsRepository.markAllReadByUser(req.user.id);
  return res.json({ message: "All notifications marked as read." });
};
