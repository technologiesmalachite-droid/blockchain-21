import { Router } from "express";
import {
  getAdminAnalytics,
  getAdminKycCaseDocuments,
  getAdminKycDocumentPreview,
  getAdminKyc,
  getAdminTransactions,
  getAdminUsers,
  getAuditLogs,
  getComplianceCases,
  getComplianceOverview,
  purgeExpiredKycDocumentsController,
  postKycReviewDecision,
  resolveComplianceCase,
  updateAccountRestrictions,
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { accountRestrictionSchema, kycCaseIdSchema, kycDocumentIdSchema, kycReviewSchema } from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/users", asyncHandler(getAdminUsers));
router.get("/kyc", asyncHandler(getAdminKyc));
router.get("/kyc/:caseId/documents", validate(kycCaseIdSchema), asyncHandler(getAdminKycCaseDocuments));
router.get("/kyc/documents/:documentId/file", validate(kycDocumentIdSchema), asyncHandler(getAdminKycDocumentPreview));
router.post("/kyc/purge-expired", asyncHandler(purgeExpiredKycDocumentsController));
router.get("/transactions", asyncHandler(getAdminTransactions));
router.get("/analytics", asyncHandler(getAdminAnalytics));
router.get("/compliance/overview", asyncHandler(getComplianceOverview));
router.get("/compliance/cases", asyncHandler(getComplianceCases));
router.post("/compliance/kyc-review", validate(kycReviewSchema), asyncHandler(postKycReviewDecision));
router.post("/compliance/account-restrictions", validate(accountRestrictionSchema), asyncHandler(updateAccountRestrictions));
router.post("/compliance/cases/:caseId/resolve", asyncHandler(resolveComplianceCase));
router.get("/audit-logs", asyncHandler(getAuditLogs));

export default router;
