import { withTransaction } from "../db/transaction.js";
import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { kycCasesRepository } from "../repositories/kycCasesRepository.js";
import { kycProfilesRepository } from "../repositories/kycProfilesRepository.js";
import { usersRepository } from "../repositories/usersRepository.js";
import { assignUserRiskScore, openComplianceCase, screenUserForSanctions } from "./complianceService.js";
import { providers } from "./providerRegistry.js";
import { jobQueue } from "../workers/jobQueue.js";

const KYC_RULES = {
  IN: {
    label: "India",
    requiredFields: ["fullLegalName", "dob", "mobile", "email", "address"],
    methods: [
      { key: "pan", label: "PAN verification", requiresDocument: true },
      { key: "aadhaar", label: "Aadhaar (approved flow)", requiresDocument: true, digilockerSupported: true },
      { key: "passport", label: "Passport", requiresDocument: true },
      { key: "driving_license", label: "Driving License", requiresDocument: true },
      { key: "government_id", label: "Other government-issued ID", requiresDocument: true },
    ],
    addressProofRequired: true,
    nonDocumentaryVerification: false,
    sanctionsScreening: true,
  },
  US: {
    label: "United States",
    requiredFields: ["fullLegalName", "dob", "residentialAddress", "email"],
    methods: [
      { key: "driver_license", label: "Driver’s License", requiresDocument: true },
      { key: "state_id", label: "State ID", requiresDocument: true },
      { key: "passport", label: "Passport", requiresDocument: true },
      { key: "ssn_tin", label: "SSN/TIN flow", requiresDocument: false },
    ],
    addressProofRequired: false,
    nonDocumentaryVerification: true,
    sanctionsScreening: true,
  },
};

const defaultRules = {
  label: "Global",
  requiredFields: ["fullLegalName", "dob", "email", "address"],
  methods: [{ key: "passport", label: "Passport", requiresDocument: true }],
  addressProofRequired: false,
  nonDocumentaryVerification: false,
  sanctionsScreening: true,
};

const maskIdNumber = (idNumber) => {
  if (!idNumber) {
    return null;
  }

  if (idNumber.length <= 4) {
    return "****";
  }

  return `${idNumber.slice(0, 2)}***${idNumber.slice(-2)}`;
};

export const getJurisdictionRules = (countryCode) => KYC_RULES[countryCode?.toUpperCase()] || defaultRules;

export const listJurisdictionOptions = (countryCode) => {
  const normalizedCountry = (countryCode || "US").toUpperCase();
  const rules = getJurisdictionRules(normalizedCountry);

  return {
    countryCode: normalizedCountry,
    jurisdiction: rules.label,
    requiredFields: rules.requiredFields,
    methods: rules.methods,
    addressProofRequired: rules.addressProofRequired,
    nonDocumentaryVerification: rules.nonDocumentaryVerification,
    digilockerAvailable: normalizedCountry === "IN",
    sanctionsScreening: rules.sanctionsScreening,
  };
};

export const submitKycApplication = async ({ user, payload }) => {
  return withTransaction(async (db) => {
    const jurisdiction = (payload.countryCode || user.countryCode || "US").toUpperCase();
    const options = listJurisdictionOptions(jurisdiction);

    if (!options.methods.some((method) => method.key === payload.verificationMethod)) {
      throw new Error("Selected verification method is not supported for this jurisdiction.");
    }

    let digilockerReference = null;

    if (jurisdiction === "IN" && payload.useDigiLocker) {
      const digilockerResult = await providers.digilocker.fetchDocument({
        countryCode: jurisdiction,
        documentType: payload.verificationMethod,
        userId: user.id,
      });

      digilockerReference = digilockerResult.requestId;
    }

    const idvResult = await providers.identity.verifyKycSubmission({
      jurisdiction,
      verificationMethod: payload.verificationMethod,
      selfieProvided: payload.selfieProvided,
      documentProvided: payload.documentProvided,
      useDigiLocker: payload.useDigiLocker,
      fullLegalName: payload.fullLegalName,
    });

    const sanctionsResult = await screenUserForSanctions(
      {
        ...user,
        fullName: payload.fullLegalName || user.fullName,
      },
      db,
    );

    const aggregateRisk = Math.max(0, Math.min(100, Math.round((idvResult.score + sanctionsResult.matchScore) / 2)));

    const status = sanctionsResult.status === "possible_match" || idvResult.requiresManualReview ? "under_review" : "approved";

    const caseRecord = await kycCasesRepository.create(
      {
        userId: user.id,
        caseType: "submission",
        jurisdiction,
        selectedMethod: payload.verificationMethod,
        status,
        riskScore: aggregateRisk,
        sanctionsResult: sanctionsResult.status,
        reviewerId: null,
        reviewerNote: null,
        idempotencyKey: `kyc_${user.id}_${Date.now()}`,
        metadata: {
          idvReference: idvResult.referenceId,
          sanctionsReference: sanctionsResult.caseReference,
        },
      },
      db,
    );

    await kycProfilesRepository.upsert(
      {
        userId: user.id,
        jurisdiction,
        legalName: payload.fullLegalName,
        dob: payload.dob,
        mobile: payload.mobile,
        email: payload.email,
        residentialAddress: payload.address,
        verificationMethod: payload.verificationMethod,
        idNumberMasked: maskIdNumber(payload.idNumber),
        selfieStatus: payload.selfieProvided ? "provided" : "missing",
        livenessStatus: idvResult.livenessStatus,
        documentaryStatus: idvResult.documentaryStatus,
        nonDocumentaryStatus: idvResult.nonDocumentaryStatus,
        addressVerificationStatus: payload.addressProofProvided ? "submitted" : "not_submitted",
        digilockerReference,
        metadata: {
          selectedMethod: payload.verificationMethod,
        },
      },
      db,
    );

    await usersRepository.updateById(
      user.id,
      {
        kycStatus: status,
        kycTier: status === "approved" ? "enhanced" : "pending",
      },
      db,
    );

    await assignUserRiskScore(user.id, aggregateRisk, db);

    await auditLogsRepository.create(
      {
        action: "kyc_submitted",
        actorId: user.id,
        actorRole: user.role,
        resourceType: "user",
        resourceId: user.id,
        metadata: {
          jurisdiction,
          status,
          riskScore: aggregateRisk,
          method: payload.verificationMethod,
        },
      },
      db,
    );

    await jobQueue.publish(
      "kyc.submission.created",
      {
        userId: user.id,
        kycCaseId: caseRecord.id,
        jurisdiction,
        status,
      },
      db,
    );
    if (status !== "approved") {
      await openComplianceCase(
        {
          userId: user.id,
          type: "kyc_manual_review",
          severity: aggregateRisk >= 75 ? "high" : "medium",
          title: "KYC requires manual review",
          description: "Submission triggered manual compliance review checks.",
          riskScore: aggregateRisk,
          tags: ["kyc", jurisdiction.toLowerCase(), payload.verificationMethod],
          metadata: {
            kycCaseId: caseRecord.id,
          },
          actorId: "system",
          actorRole: "system",
          idempotencyKey: `kyc_review_${caseRecord.id}`,
        },
        db,
      );
    }

    return {
      submission: {
        ...caseRecord,
        selectedMethod: caseRecord.selectedMethod,
      },
      options,
      identityVerification: idvResult,
      sanctions: sanctionsResult,
    };
  });
};

export const getKycStatusForUser = async (user) => {
  const [profile, latestSubmission, auditTrail] = await Promise.all([
    kycProfilesRepository.findByUserId(user.id),
    kycCasesRepository.findLatestByUser(user.id),
    auditLogsRepository.listForUserKyc(user.id, 10),
  ]);

  return {
    status: user.kycStatus,
    tier: user.kycTier,
    profile,
    latestSubmission,
    auditTrail,
  };
};

export const listKycQueue = () => kycCasesRepository.listPending();

export const reviewKycSubmission = async ({ actor, submissionId, decision, note }) => {
  const submission = await kycCasesRepository.findById(submissionId);

  if (!submission) {
    throw new Error("KYC submission not found.");
  }

  const updatedSubmission = await withTransaction(async (db) => {
    const decisionResult = await kycCasesRepository.updateDecision(
      {
        caseId: submissionId,
        status: decision,
        reviewerId: actor.id,
        reviewerNote: note || null,
      },
      db,
    );

    await usersRepository.updateById(
      submission.userId,
      {
        kycStatus: decision,
        kycTier: decision === "approved" ? "enhanced" : "none",
      },
      db,
    );

    await auditLogsRepository.create(
      {
        action: "kyc_review_decision",
        actorId: actor.id,
        actorRole: actor.role,
        resourceType: "user",
        resourceId: submission.userId,
        metadata: {
          submissionId,
          decision,
          note,
        },
      },
      db,
    );

    return decisionResult;
  });

  return updatedSubmission;
};

