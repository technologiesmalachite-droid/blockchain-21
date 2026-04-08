import { v4 as uuid } from "uuid";
import { db } from "../services/demoDb.js";

export const createTicket = (req, res) => {
  const ticket = {
    id: uuid(),
    userId: req.user.id,
    ...req.validated.body,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  db.supportTickets.unshift(ticket);
  return res.status(201).json({ ticket, message: "Support ticket created." });
};

export const getSupportTickets = (req, res) =>
  res.json({ items: db.supportTickets.filter((ticket) => ticket.userId === req.user.id || req.user.role === "admin") });

