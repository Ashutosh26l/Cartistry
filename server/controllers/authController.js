import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
const wantsHtml = (req) => req.headers.accept && req.headers.accept.includes("text/html");
const getRoleFromEmail = (email) => (/@tri\.com$/i.test(String(email || "").trim()) ? "retailer" : "buyer");

export const renderRegisterPage = (req, res) => {
  return res.render("register", { error: null, form: {} });
};

export const renderLoginPage = (req, res) => {
  return res.render("login", { error: null, form: {} });
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      if (wantsHtml(req)) {
        return res
          .status(400)
          .render("register", { error: "Name, email and password are required", form: req.body });
      }
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
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

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      if (wantsHtml(req)) {
        return res.status(401).render("login", { error: "Invalid email or password", form: req.body });
      }
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(String(password));
    if (!isMatch) {
      if (wantsHtml(req)) {
        return res.status(401).render("login", { error: "Invalid email or password", form: req.body });
      }
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const computedRole = getRoleFromEmail(normalizedEmail);
    if (user.role !== "admin" && user.role !== computedRole) {
      user.role = computedRole;
      await user.save();
    }

    const token = signToken(user._id.toString());

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    if (wantsHtml(req)) {
      return res.redirect("/");
    }

    return res.status(200).json({
      message: "Login successful",
      token,
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
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (wantsHtml(req)) {
    return res.redirect("/auth/login");
  }

  return res.status(200).json({ message: "Logout successful" });
};
