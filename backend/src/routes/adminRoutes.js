import { Router } from "express";
import {
  getAdminAnalytics,
  getAdminKyc,
  getAdminTransactions,
  getAdminUsers,
  getAuditLogs,
  getComplianceCases,
  getComplianceOverview,
  postKycReviewDecision,
  resolveComplianceCase,
  updateAccountRestrictions,
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { accountRestrictionSchema, kycReviewSchema } from "../models/schemas.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/users", getAdminUsers);
router.get("/kyc", getAdminKyc);
router.get("/transactions", getAdminTransactions);
router.get("/analytics", getAdminAnalytics);
router.get("/compliance/overview", getComplianceOverview);
router.get("/compliance/cases", getComplianceCases);
router.post("/compliance/kyc-review", validate(kycReviewSchema), postKycReviewDecision);
router.post("/compliance/account-restrictions", validate(accountRestrictionSchema), updateAccountRestrictions);
router.post("/compliance/cases/:caseId/resolve", resolveComplianceCase);
router.get("/audit-logs", getAuditLogs);

export default router;
