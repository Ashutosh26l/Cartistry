import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import flash from "connect-flash";
import helmet from "helmet";
import productRoutes from "./routes/productRoutes.js";
import productApiRoutes from "./routes/productApiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import retailerRoutes from "./routes/retailerRoutes.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { ensureCsrfToken, verifyCsrfToken } from "./middleware/csrf.js";
import path from "path";
import corsMiddleware from "./config/cors.js";
import { sessionConfig } from "./config/session.js";
import { authRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";
import { attachFlashMessages } from "./middleware/flashMessages.js";
import { attachBuyerNotificationCount, attachRetailerNotificationCount } from "./middleware/retailerNotifications.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const MIN_SECRET_LENGTH = 32;
const WEAK_COOKIE_VALUES = new Set(["replace_with_a_long_random_cookie_secret"]);

const resolveCookieSecret = () => {
  const secret = String(process.env.COOKIE_SECRET || "").trim();
  const isWeak = !secret || secret.length < MIN_SECRET_LENGTH || WEAK_COOKIE_VALUES.has(secret);

  if (isProduction && isWeak) {
    throw new Error("COOKIE_SECRET must be a strong random value in production (32+ chars).");
  }

  if (isWeak) {
    console.warn(
      "Weak COOKIE_SECRET detected for development. Use a strong 32+ character secret before production deployment."
    );
  }

  return secret || "development-only-insecure-cookie-secret";
};

app.use(express.static(path.join(path.resolve(), "/public")));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), "/views"));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser(resolveCookieSecret()));
app.use(session(sessionConfig));
app.use(flash());
app.use(attachFlashMessages);
// Restrictive CORS with explicit production allow-list and localhost flexibility in development.
app.use(corsMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        objectSrc: ["'none'"],
        // Keep app on HTTP until real TLS is configured.
        upgradeInsecureRequests: null,
      },
    },
    // Do not force HTTPS unless TLS is actually configured at the edge.
    hsts: process.env.ENABLE_HSTS === "true",
  })
);
// Populate current user from session/JWT and make CSRF token available on safe requests.
app.use(attachCurrentUser);
app.use(attachRetailerNotificationCount);
app.use(attachBuyerNotificationCount);
app.use(ensureCsrfToken);
if (process.env.NODE_ENV !== "production") {
  app.use(debugRoutes);
}
// Route groups: auth routes are CSRF-protected (and API auth is rate-limited).
app.use("/api/auth", authRateLimiter, verifyCsrfToken, authRoutes);
app.use("/auth", authRateLimiter, verifyCsrfToken, authRoutes);
app.use("/api/products", productApiRoutes);
app.use("/products", verifyCsrfToken, productRoutes);
app.use(verifyCsrfToken, retailerRoutes);
app.use(siteRoutes);
// 404 handler for unmatched routes.
app.use(notFoundHandler);
// Centralized error handler.
app.use(errorHandler);

export default app;
