import express from "express";
import {
  getSignedCookie,
  greetFromCookie,
  greetFromSession,
  setCookie,
  setSessionName,
  showSignedCookies,
  viewCount,
} from "../controllers/debugController.js";

const router = express.Router();

// Utility/demo cookie and session routes.
router.get("/setcookie", setCookie);
router.get("/greet", greetFromCookie);
router.get("/getsignedcookie", getSignedCookie);
router.get("/showsigned", showSignedCookies);
router.get("/viewcount", viewCount);
router.get("/setname", setSessionName);
router.get("/greet-session", greetFromSession);

export default router;
