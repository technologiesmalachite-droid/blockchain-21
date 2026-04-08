import { Router } from "express";
import { getMarketDetails, getMarkets } from "../controllers/marketController.js";

const router = Router();

router.get("/", getMarkets);
router.get("/:symbol", getMarketDetails);

export default router;

