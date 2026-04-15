import { notificationsRepository } from "../repositories/notificationsRepository.js";

export const notifyUser = async (
  {
    userId,
    category,
    severity = "info",
    title,
    message,
    actionUrl = null,
    metadata = {},
  },
  db,
) => {
  if (!userId || !category || !title || !message) {
    return null;
  }

  try {
    return notificationsRepository.create(
      {
        userId,
        category,
        severity,
        title,
        message,
        actionUrl,
        metadata,
      },
      db,
    );
  } catch (error) {
    console.error("Failed to persist user notification", {
      code: error?.code || null,
      message: error?.message || "unknown_error",
      userId,
      category,
    });
    return null;
  }
};
