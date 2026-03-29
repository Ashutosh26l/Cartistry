import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { logSecurityEvent } from "./securityEvents.js";

const getCookieValue = (req, key) => req.cookies?.[key] || null;

const extractToken = (req) => getCookieValue(req, "token");
const getJwtSecret = () => String(process.env.JWT_SECRET || "");
const verifyToken = (token) => jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

const authMiddleware = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      logSecurityEvent(req, "api_auth_missing_token");
      return res.status(401).json({ message: "Unauthorized: token missing" });
    }

    const decoded = verifyToken(token);
    req.user = { id: decoded.userId };
    return next();
  } catch (error) {
    logSecurityEvent(req, "api_auth_invalid_token");
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

export const requireAuthPage = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.redirect("/auth/login");
    const decoded = verifyToken(token);
    req.user = { id: decoded.userId };
    return next();
  } catch (error) {
    logSecurityEvent(req, "page_auth_invalid_token");
    return res.redirect("/auth/login");
  }
};

export const requireRetailerPage = (req, res, next) => {
  if (!res.locals.currentUser) return res.redirect("/auth/login");
  if (res.locals.currentUser.role === "retailer" || res.locals.currentUser.role === "admin") {
    return next();
  }
  return res.status(403).render("error", { statusCode: 403, message: "Retailer access only" });
};

export const requireRetailerApi = (req, res, next) => {
  const role = res.locals.currentUser?.role;
  if (!res.locals.currentUser) {
    return res.status(401).json({ message: "Unauthorized: login required" });
  }
  if (role === "retailer" || role === "admin") return next();
  return res.status(403).json({ message: "Forbidden: retailer access only" });
};

export const requireBuyerPage = (req, res, next) => {
  if (!res.locals.currentUser) return res.redirect("/auth/login");
  if (res.locals.currentUser.role === "buyer") return next();
  return res.status(403).render("error", { statusCode: 403, message: "Buyer access only" });
};

export const attachCurrentUser = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.locals.currentUser = null;
      return next();
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select("name email role wishlist");
    res.locals.currentUser = user || null;
    if (user) req.user = { id: user._id.toString() };
    return next();
  } catch (error) {
    res.locals.currentUser = null;
    return next();
  }
};

export default authMiddleware;
