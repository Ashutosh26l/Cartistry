import rateLimit from "express-rate-limit";

// Protect auth endpoints from brute-force requests.
export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts. Please try again later." },
});

export default authRateLimiter;
