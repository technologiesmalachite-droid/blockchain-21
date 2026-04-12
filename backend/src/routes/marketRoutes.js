import { Router } from "express";
import { getMarketDetails, getMarkets } from "../controllers/marketController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getMarkets));
router.get("/:symbol", asyncHandler(getMarketDetails));

export default router;
