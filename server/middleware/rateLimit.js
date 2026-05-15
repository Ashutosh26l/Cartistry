import rateLimit from "express-rate-limit";
import { logSecurityEvent } from "./securityEvents.js";

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20", 10);
const PUBLIC_READ_WINDOW_MS = 60 * 1000;
const PUBLIC_READ_MAX = Number.parseInt(process.env.PUBLIC_READ_RATE_LIMIT_MAX || "120", 10);
const WRITE_WINDOW_MS = 5 * 60 * 1000;
const WRITE_MAX = Number.parseInt(process.env.WRITE_RATE_LIMIT_MAX || "60", 10);
const CART_CHECKOUT_WINDOW_MS = 5 * 60 * 1000;
const CART_CHECKOUT_MAX = Number.parseInt(process.env.CART_CHECKOUT_RATE_LIMIT_MAX || "25", 10);
const BULK_WINDOW_MS = 10 * 60 * 1000;
const BULK_MAX = Number.parseInt(process.env.BULK_OPERATION_RATE_LIMIT_MAX || "8", 10);

const wantsHtml = (req) => req.headers.accept && req.headers.accept.includes("text/html");
const coerceMax = (value, fallback, min = 1) => (Number.isFinite(value) ? Math.max(min, value) : fallback);

const createLimiter = ({
  windowMs,
  max,
  event,
  jsonMessage,
  htmlMessage,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { message: jsonMessage },
    handler: (req, res, next, options) => {
      logSecurityEvent(req, event, {
        limit: options.max,
        windowMs: options.windowMs,
      });
      if (wantsHtml(req)) {
        return res.status(options.statusCode).render("error", {
          statusCode: options.statusCode,
          message: htmlMessage,
        });
      }
      return res.status(options.statusCode).json(options.message);
    },
  });

// Protect auth endpoints from brute-force requests.
export const authRateLimiter = createLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: coerceMax(AUTH_RATE_LIMIT_MAX, 20, 5),
  event: "auth_rate_limited",
  skipSuccessfulRequests: true,
  jsonMessage: "Too many auth attempts. Please try again later.",
  htmlMessage: "Too many login/register attempts. Please try again in a few minutes.",
});

// Protect public GET-heavy pages/endpoints from traffic spikes.
export const publicReadRateLimiter = createLimiter({
  windowMs: PUBLIC_READ_WINDOW_MS,
  max: coerceMax(PUBLIC_READ_MAX, 120, 30),
  event: "public_read_rate_limited",
  jsonMessage: "Too many requests. Please slow down and try again.",
  htmlMessage: "Too many page requests in a short time. Please wait and retry.",
});

// Generic write limiter for non-bulk data mutation endpoints.
export const writeRateLimiter = createLimiter({
  windowMs: WRITE_WINDOW_MS,
  max: coerceMax(WRITE_MAX, 60, 10),
  event: "write_rate_limited",
  jsonMessage: "Too many write requests. Please retry shortly.",
  htmlMessage: "Too many form submissions. Please wait and try again.",
});

// Sensitive buyer flows (cart/checkout) get a tighter limiter.
export const cartCheckoutRateLimiter = createLimiter({
  windowMs: CART_CHECKOUT_WINDOW_MS,
  max: coerceMax(CART_CHECKOUT_MAX, 25, 8),
  event: "cart_checkout_rate_limited",
  jsonMessage: "Too many cart or checkout requests. Please retry shortly.",
  htmlMessage: "Cart/checkout actions are happening too fast. Please wait and retry.",
});

// Expensive retailer bulk operations are strictly limited.
export const bulkOperationRateLimiter = createLimiter({
  windowMs: BULK_WINDOW_MS,
  max: coerceMax(BULK_MAX, 8, 3),
  event: "bulk_operation_rate_limited",
  jsonMessage: "Too many bulk operation attempts. Please retry later.",
  htmlMessage: "Bulk actions are limited for safety. Please try again in a few minutes.",
});

export default {
  authRateLimiter,
  publicReadRateLimiter,
  writeRateLimiter,
  cartCheckoutRateLimiter,
  bulkOperationRateLimiter,
};
