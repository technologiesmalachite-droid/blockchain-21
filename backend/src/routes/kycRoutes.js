import { Router } from "express";
import {
  deleteKycDocument,
  getKycDocument,
  getKycOptions,
  getKycStatus,
  sendEmailOtp,
  sendMobileOtp,
  submitKyc,
  submitKycDocumentsController,
  submitKycProfileController,
  verifyEmailOtp,
  verifyMobileOtp,
} from "../controllers/kycController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveAccount, requireConsents } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import {
  kycDocumentIdSchema,
  kycOptionsSchema,
  kycProfileSubmissionSchema,
  kycSchema,
  otpCodeSchema,
} from "../models/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { otpSendLimiter, otpVerifyLimiter } from "../middleware/rateLimits.js";
import { kycDocumentUploadSafe } from "../middleware/kycUpload.js";

const router = Router();

router.get("/options/:countryCode", requireAuth, requireActiveAccount, validate(kycOptionsSchema), asyncHandler(getKycOptions));
router.post("/email/send-otp", requireAuth, requireActiveAccount, otpSendLimiter, asyncHandler(sendEmailOtp));
router.post("/email/verify-otp", requireAuth, requireActiveAccount, otpVerifyLimiter, validate(otpCodeSchema), asyncHandler(verifyEmailOtp));
router.post("/mobile/send-otp", requireAuth, requireActiveAccount, otpSendLimiter, asyncHandler(sendMobileOtp));
router.post("/mobile/verify-otp", requireAuth, requireActiveAccount, otpVerifyLimiter, validate(otpCodeSchema), asyncHandler(verifyMobileOtp));
router.post("/profile", requireAuth, requireActiveAccount, requireConsents, validate(kycProfileSubmissionSchema), asyncHandler(submitKycProfileController));
router.post("/documents/upload", requireAuth, requireActiveAccount, requireConsents, kycDocumentUploadSafe, asyncHandler(submitKycDocumentsController));
router.get("/documents/:documentId/file", requireAuth, requireActiveAccount, validate(kycDocumentIdSchema), asyncHandler(getKycDocument));
router.delete("/documents/:documentId", requireAuth, requireActiveAccount, validate(kycDocumentIdSchema), asyncHandler(deleteKycDocument));
router.post("/submit", requireAuth, requireActiveAccount, requireConsents, validate(kycSchema), asyncHandler(submitKyc));
router.get("/status", requireAuth, requireActiveAccount, asyncHandler(getKycStatus));

export default router;
