import express from "express";
import {
  getApiHealth,
  getHealth,
  renderHelpCenter,
  renderHome,
  renderReturns,
  renderShipping,
} from "../controllers/siteController.js";

const router = express.Router();

router.get("/", renderHome);
router.get("/api/health", getApiHealth);
router.get("/health", getHealth);
router.get("/help-center", renderHelpCenter);
router.get("/returns", renderReturns);
router.get("/shipping", renderShipping);

export default router;
