import crypto from "crypto";
import { logSecurityEvent } from "./securityEvents.js";

const CSRF_COOKIE = "csrfToken";

const isUnsafeMethod = (method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method);

const getCsrfCookieToken = (req) => req.signedCookies?.[CSRF_COOKIE] || req.cookies?.[CSRF_COOKIE] || "";

const tokensMatch = (left, right) => {
  const leftValue = String(left || "");
  const rightValue = String(right || "");
  if (!leftValue || !rightValue) return false;
  const leftBuffer = Buffer.from(leftValue);
  const rightBuffer = Buffer.from(rightValue);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const ensureCsrfToken = (req, res, next) => {
  let token = getCsrfCookieToken(req);

  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      signed: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  res.locals.csrfToken = token;
  next();
};

export const verifyCsrfToken = (req, res, next) => {
  if (!isUnsafeMethod(req.method)) return next();

  const cookieToken = getCsrfCookieToken(req);
  const formToken = req.body?._csrf;
  const headerToken = req.headers["x-csrf-token"];
  const requestToken = formToken || headerToken;

  if (!tokensMatch(cookieToken, requestToken)) {
    logSecurityEvent(req, "csrf_validation_failed", {
      hasCookieToken: Boolean(cookieToken),
      hasRequestToken: Boolean(requestToken),
    });
    return res.status(403).send("Invalid CSRF token");
  }

  next();
};
