import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { logSecurityEvent } from "../middleware/securityEvents.js";

const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const getJwtSecret = () => String(process.env.JWT_SECRET || "");
const getConfiguredRetailerDomain = () =>
  String(process.env.RETAILER_EMAIL_DOMAIN || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

const getRoleFromEmail = (email) => {
  const retailerDomain = getConfiguredRetailerDomain();
  if (!retailerDomain) return "buyer";
  return normalizeEmail(email).endsWith(`@${retailerDomain}`) ? "retailer" : "buyer";
};

const signToken = (userId) => jwt.sign({ userId }, getJwtSecret(), { algorithm: "HS256", expiresIn: "1d" });
const wantsHtml = (req) => req.headers.accept && req.headers.accept.includes("text/html");
const getTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
});

export const renderRegisterPage = (req, res) => {
  return res.render("register", { error: null, form: {} });
};

export const renderLoginPage = (req, res) => {
  return res.render("login", { error: null, form: {} });
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !email || !password) {
      if (wantsHtml(req)) {
        return res
          .status(400)
          .render("register", { error: "Name, email and password are required", form: req.body });
      }
      return res.status(400).json({ message: "name, email and password are required" });
    }

    if (!isValidEmail(normalizedEmail)) {
      if (wantsHtml(req)) {
        return res.status(400).render("register", { error: "Please provide a valid email address", form: req.body });
      }
      return res.status(400).json({ message: "invalid email address" });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      if (wantsHtml(req)) {
        return res.status(400).render("register", {
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          form: req.body,
        });
      }
      return res.status(400).json({ message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (wantsHtml(req)) {
        return res.status(409).render("register", { error: "Email already registered", form: req.body });
      }
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role: getRoleFromEmail(normalizedEmail),
    });

    if (wantsHtml(req)) {
      return res.redirect("/auth/login");
    }

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      if (wantsHtml(req)) {
        return res.status(409).render("register", { error: "Email already registered", form: req.body });
      }
      return res.status(409).json({ message: "Email already registered" });
    }
    if (wantsHtml(req)) {
      return res.status(500).render("register", { error: "Registration failed", form: req.body });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      if (wantsHtml(req)) {
        return res
          .status(400)
          .render("login", { error: "Email and password are required", form: req.body });
      }
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      logSecurityEvent(req, "login_failed_unknown_user", { email: normalizedEmail });
      if (wantsHtml(req)) {
        return res.status(401).render("login", { error: "Invalid email or password", form: req.body });
      }
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(String(password));
    if (!isMatch) {
      logSecurityEvent(req, "login_failed_bad_password", { email: normalizedEmail });
      if (wantsHtml(req)) {
        return res.status(401).render("login", { error: "Invalid email or password", form: req.body });
      }
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id.toString());

    res.cookie("token", token, getTokenCookieOptions());

    if (wantsHtml(req)) {
      return res.redirect("/");
    }

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (wantsHtml(req)) {
      return res.status(500).render("login", { error: "Login failed", form: req.body });
    }
    return res.status(500).json({ message: "Login failed" });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", getTokenCookieOptions());

  if (wantsHtml(req)) {
    return res.redirect("/auth/login");
  }

  return res.status(200).json({ message: "Logout successful" });
};
