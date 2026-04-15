import { Router } from "express";
import { getBinanceMarkets, getMarketDetails, getMarkets, getSpotOrderBook } from "../controllers/marketController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getMarkets));
router.get("/binance", asyncHandler(getBinanceMarkets));
router.get("/orderbook", asyncHandler(getSpotOrderBook));
router.get("/:symbol", asyncHandler(getMarketDetails));

export default router;
