import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const getCookieValue = (req, key) => req.cookies?.[key] || null;

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const cookieToken = getCookieValue(req, "token");
  return bearerToken || cookieToken;
};

const authMiddleware = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

export const requireAuthPage = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.redirect("/auth/login");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId };
    return next();
  } catch (error) {
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("name email role");
    res.locals.currentUser = user || null;
    if (user) req.user = { id: user._id.toString() };
    return next();
  } catch (error) {
    res.locals.currentUser = null;
    return next();
  }
};

export default authMiddleware;
