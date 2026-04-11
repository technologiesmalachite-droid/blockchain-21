import { query } from "../db/pool.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { complianceCasesRepository } from "../repositories/complianceCasesRepository.js";
import { supportTicketsRepository } from "../repositories/supportTicketsRepository.js";
import { usersRepository, accountRestrictionsRepository } from "../repositories/usersRepository.js";
import { walletTransactionsRepository } from "../repositories/walletTransactionsRepository.js";
import { closeComplianceCase } from "../services/complianceService.js";
import { listKycQueue, reviewKycSubmission } from "../services/kycService.js";

export const getAdminUsers = async (_req, res) => {
  const users = await usersRepository.listAll();

  return res.json({
    items: users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      countryCode: user.countryCode,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      kycStatus: user.kycStatus,
      sanctionsStatus: user.sanctionsStatus,
      riskScore: user.riskScore,
      restrictions: user.accountRestrictions,
      createdAt: user.createdAt,
    })),
  });
};

export const getAdminKyc = async (_req, res) => res.json({ items: await listKycQueue() });

export const getAdminTransactions = async (_req, res) => res.json({ items: await walletTransactionsRepository.listAllForAdmin() });

export const getAdminAnalytics = async (_req, res) => {
  const [
    openCases,
    kycQueue,
    openTickets,
    users,
    volumeRows,
    feeRows,
  ] = await Promise.all([
    complianceCasesRepository.countOpen(),
    listKycQueue(),
    supportTicketsRepository.countOpen(),
    usersRepository.listAll(),
    query(`SELECT COALESCE(SUM(notional),0)::numeric AS volume_24h FROM trades WHERE created_at > NOW() - INTERVAL '24 hours'`),
    query(`SELECT COALESCE(SUM(fee),0)::numeric AS fee_24h FROM trades WHERE created_at > NOW() - INTERVAL '24 hours'`),
  ]);

  const flaggedAccounts = users.filter((user) => user.sanctionsStatus === "review_required" || user.riskScore > 60).length;

  return res.json({
    metrics: {
      activeUsers24h: users.length,
      tradingVolume24h: Number(volumeRows.rows[0]?.volume_24h || 0),
      platformFees24h: Number(feeRows.rows[0]?.fee_24h || 0),
      flaggedAccounts,
      openComplianceCases: openCases,
      kycQueueCount: kycQueue.length,
      ticketsOpen: openTickets,
    },
    feeMix: [
      { label: "Spot", value: 54 },
      { label: "Futures", value: 23 },
      { label: "Earn", value: 11 },
      { label: "Withdrawal", value: 12 },
    ],
  });
};

export const getComplianceCases = async (_req, res) => res.json({ items: await complianceCasesRepository.listAll() });

export const getComplianceOverview = async (_req, res) => {
  const [openCases, highRiskCases, pendingKyc, usersCount, avgRiskScore] = await Promise.all([
    complianceCasesRepository.countOpen(),
    complianceCasesRepository.countOpenHighRisk(),
    listKycQueue(),
    usersRepository.listAll(),
    usersRepository.averageRiskScore(),
  ]);

  const restrictedAccounts = usersCount.filter((user) => user.accountRestrictions?.frozen || user.accountRestrictions?.withdrawalsLocked).length;

  return res.json({
    overview: {
      openCases,
      highRiskCases,
      pendingKyc: pendingKyc.length,
      restrictedAccounts,
      avgRiskScore,
    },
  });
};

export const postKycReviewDecision = async (req, res) => {
  try {
    const submission = await reviewKycSubmission({
      actor: req.user,
      submissionId: req.validated.body.submissionId,
      decision: req.validated.body.decision,
      note: req.validated.body.note,
    });

    return res.json({ submission, message: "KYC review updated." });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

export const updateAccountRestrictions = async (req, res) => {
  const user = await usersRepository.findById(req.validated.body.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const restrictions = await accountRestrictionsRepository.upsert({
    userId: user.id,
    frozen: req.validated.body.frozen ?? user.accountRestrictions?.frozen ?? false,
    withdrawalsLocked: req.validated.body.withdrawalsLocked ?? user.accountRestrictions?.withdrawalsLocked ?? false,
    tradingLocked: req.validated.body.tradingLocked ?? user.accountRestrictions?.tradingLocked ?? false,
    reason: req.validated.body.note || user.accountRestrictions?.reason || null,
    metadata: user.accountRestrictions?.metadata || {},
  });

  const updated = await usersRepository.findById(user.id);

  return res.json({
    user: {
      id: updated.id,
      email: updated.email,
      restrictions,
      riskScore: updated.riskScore,
    },
    message: "Account restrictions updated.",
  });
};

export const resolveComplianceCase = async (req, res) => {
  try {
    const complianceCase = await closeComplianceCase({
      caseId: req.params.caseId,
      actorId: req.user.id,
      actorRole: req.user.role,
      resolution: req.body?.resolution,
    });

    return res.json({ case: complianceCase, message: "Compliance case resolved." });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

export const getAuditLogs = async (_req, res) => res.json({ items: await auditLogsRepository.listRecent(200) });
