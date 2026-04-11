import { supportTicketsRepository } from "../repositories/supportTicketsRepository.js";

export const createTicket = async (req, res) => {
  const ticket = await supportTicketsRepository.create({
    userId: req.user.id,
    ...req.validated.body,
    status: "open",
  });

  return res.status(201).json({ ticket, message: "Support ticket created." });
};

export const getSupportTickets = async (req, res) => {
  const items = await supportTicketsRepository.listByUser(req.user.id, req.user.role === "admin");
  return res.json({ items });
};
