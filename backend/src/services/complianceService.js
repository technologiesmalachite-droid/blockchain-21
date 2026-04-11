import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { complianceCasesRepository } from "../repositories/complianceCasesRepository.js";
import { sanctionsResultsRepository } from "../repositories/sanctionsResultsRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { providers } from "./providerRegistry.js";

const clampRisk = (value) => Math.max(0, Math.min(100, Math.round(value)));

export const calculateRiskScore = ({ amount = 0, isNewDestination = false, sanctionsMatchScore = 0, failedAttempts = 0, velocityCount = 0 }) => {
  const base = Number(amount) > 10000 ? 35 : Number(amount) > 1000 ? 20 : 10;
  const destinationScore = isNewDestination ? 20 : 6;
  const velocityScore = velocityCount > 3 ? 25 : velocityCount > 1 ? 12 : 4;
  const attemptScore = failedAttempts > 0 ? Math.min(15, failedAttempts * 3) : 0;
  const sanctionsScore = sanctionsMatchScore > 80 ? 40 : sanctionsMatchScore > 50 ? 20 : 0;

  return clampRisk(base + destinationScore + velocityScore + attemptScore + sanctionsScore);
};

export const screenUserForSanctions = async (user, db) => {
  const result = await providers.sanctions.screenEntity({
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    countryCode: user.countryCode,
  });

  await sanctionsResultsRepository.create(
    {
      userId: user.id,
      providerName: result.provider,
      providerReference: result.caseReference,
      status: result.status,
      matchScore: result.matchScore,
      watchlists: result.watchlists,
      metadata: {
        screenedAt: result.screenedAt,
      },
    },
    db,
  );

  await usersRepository.updateById(
    user.id,
    {
      sanctionsStatus: result.status === "clear" ? "clear" : "review_required",
    },
    db,
  );

  await auditLogsRepository.create(
    {
      action: "sanctions_screening_performed",
      actorId: "system",
      actorRole: "system",
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        provider: result.provider,
        status: result.status,
        matchScore: result.matchScore,
      },
    },
    db,
  );

  return result;
};

export const openComplianceCase = async ({
  userId,
  type,
  severity = "medium",
  title,
  description,
  riskScore,
  tags = [],
  metadata = {},
  actorId = "system",
  actorRole = "system",
  idempotencyKey,
}, db) => {
  const existingOpenCase = await complianceCasesRepository.findOpenBySignature(
    {
      userId,
      caseType: type,
      title,
    },
    db,
  );

  if (existingOpenCase) {
    return existingOpenCase;
  }

  const complianceCase = await complianceCasesRepository.create(
    {
      userId,
      caseType: type,
      severity,
      status: "open",
      riskScore: clampRisk(riskScore),
      title,
      description,
      tags,
      metadata,
      idempotencyKey,
    },
    db,
  );

  await auditLogsRepository.create(
    {
      action: "compliance_case_opened",
      actorId,
      actorRole,
      resourceType: "compliance_case",
      resourceId: complianceCase.id,
      metadata: {
        type,
        severity,
        riskScore: complianceCase.riskScore,
        title,
      },
    },
    db,
  );

  return complianceCase;
};

export const closeComplianceCase = async ({ caseId, actorId, actorRole, resolution }, db) => {
  const complianceCase = await complianceCasesRepository.resolve(caseId, resolution || "resolved", db);

  if (!complianceCase) {
    throw new Error("Compliance case not found.");
  }

  await auditLogsRepository.create(
    {
      action: "compliance_case_resolved",
      actorId,
      actorRole,
      resourceType: "compliance_case",
      resourceId: caseId,
      metadata: {
        resolution: complianceCase.resolution,
      },
    },
    db,
  );

  return complianceCase;
};

export const evaluateWithdrawalRisk = async ({ user, amount, isNewDestination, recentWithdrawals }, db) => {
  const score = calculateRiskScore({
    amount,
    isNewDestination,
    velocityCount: recentWithdrawals,
    sanctionsMatchScore: user.sanctionsStatus === "review_required" ? 75 : 0,
  });

  const requiresManualReview = score >= 60 || user.kycStatus !== "approved" || user.accountRestrictions?.withdrawalsLocked;

  if (requiresManualReview) {
    await openComplianceCase(
      {
        userId: user.id,
        type: "withdrawal_review",
        severity: score >= 75 ? "high" : "medium",
        title: "Withdrawal queued for compliance review",
        description: "Withdrawal request triggered enhanced risk controls.",
        riskScore: score,
        tags: ["withdrawal", "risk"],
        metadata: {
          amount,
          kycStatus: user.kycStatus,
        },
        actorId: "system",
        actorRole: "system",
        idempotencyKey: `withdrawal_review_${user.id}_${Date.now()}`,
      },
      db,
    );
  }

  return {
    score,
    requiresManualReview,
  };
};

export const assignUserRiskScore = async (userId, score, db) => {
  return usersRepository.updateById(
    userId,
    {
      riskScore: clampRisk(score),
    },
    db,
  );
};
