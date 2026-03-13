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
import { attachCurrentUser } from "./middleware/auth.js";
import { ensureCsrfToken, verifyCsrfToken } from "./middleware/csrf.js";
import path from "path";
import corsMiddleware from "./config/cors.js";
import { sessionConfig } from "./config/session.js";
import { authRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";
import { attachFlashMessages } from "./middleware/flashMessages.js";
import { attachRetailerNotificationCount } from "./middleware/retailerNotifications.js";

const app = express();

app.use(express.static(path.join(path.resolve(), "/public")));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), "/views"));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(session(sessionConfig));
app.use(flash());
app.use(attachFlashMessages);
// Restrictive CORS with explicit production allow-list and localhost flexibility in development.
app.use(corsMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
// Populate current user from session/JWT and make CSRF token available on safe requests.
app.use(attachCurrentUser);
app.use(attachRetailerNotificationCount);
app.use(ensureCsrfToken);
app.use(debugRoutes);
// Route groups: auth routes are CSRF-protected (and API auth is rate-limited).
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/auth", authRateLimiter, verifyCsrfToken, authRoutes);
app.use("/api/products", productApiRoutes);
app.use("/products", verifyCsrfToken, productRoutes);
app.use(siteRoutes);
// 404 handler for unmatched routes.
app.use(notFoundHandler);
// Centralized error handler.
app.use(errorHandler);

export default app;
