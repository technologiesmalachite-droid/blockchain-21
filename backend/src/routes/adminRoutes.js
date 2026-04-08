import { Router } from "express";
import { getAdminAnalytics, getAdminKyc, getAdminTransactions, getAdminUsers } from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/users", getAdminUsers);
router.get("/kyc", getAdminKyc);
router.get("/transactions", getAdminTransactions);
router.get("/analytics", getAdminAnalytics);

export default router;

