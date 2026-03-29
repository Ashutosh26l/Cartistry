import rateLimit from "express-rate-limit";
import { logSecurityEvent } from "./securityEvents.js";

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20", 10);

const wantsHtml = (req) => req.headers.accept && req.headers.accept.includes("text/html");

// Protect auth endpoints from brute-force requests.
export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: Number.isFinite(AUTH_RATE_LIMIT_MAX) ? Math.max(5, AUTH_RATE_LIMIT_MAX) : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many auth attempts. Please try again later." },
  handler: (req, res, next, options) => {
    logSecurityEvent(req, "auth_rate_limited", {
      limit: options.max,
      windowMs: options.windowMs,
    });
    if (wantsHtml(req)) {
      return res.status(options.statusCode).render("error", {
        statusCode: options.statusCode,
        message: "Too many login/register attempts. Please try again in a few minutes.",
      });
    }
    return res.status(options.statusCode).json(options.message);
  },
});

export default authRateLimiter;
