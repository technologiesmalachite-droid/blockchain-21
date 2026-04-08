import { v4 as uuid } from "uuid";
import { db } from "../services/demoDb.js";

export const submitKyc = (req, res) => {
  const submission = {
    id: uuid(),
    userId: req.user.id,
    ...req.validated.body,
    status: "under_review",
    createdAt: new Date().toISOString(),
  };

  db.kycSubmissions.push(submission);
  req.user.kycStatus = "under_review";
  return res.status(201).json({ submission, message: "KYC submitted for review." });
};

export const getKycStatus = (req, res) =>
  res.json({
    status: req.user.kycStatus,
    latest: db.kycSubmissions.filter((item) => item.userId === req.user.id).at(-1) || null,
  });

