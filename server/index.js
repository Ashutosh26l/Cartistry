import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import session from "express-session";
import flash from "connect-flash";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import productRoutes from "./routes/productRoutes.js";
import productApiRoutes from "./routes/productApiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import connectDb from "./config/db.js";
import Product from "./models/productModel.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { ensureCsrfToken, verifyCsrfToken } from "./middleware/csrf.js";
import path from "path";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5500;
const normalizeOrigin = (origin) => String(origin || "").trim().replace(/\/$/, "");
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`)
  .split(",")
  .map((item) => normalizeOrigin(item))
  .filter(Boolean);

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts. Please try again later." },
});

app.use(express.static(path.join(path.resolve(), "/public")));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), "/views"));
app.use(express.json());
app.use(cookieParser("youneedabettersecret"));

const configSession = {
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: true,
};

app.use(session(configSession));
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      const isNullOrigin = normalizedOrigin.toLowerCase() === "null";
      const isLocalhostDevOrigin =
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
      const allowNullOriginInDev = process.env.NODE_ENV !== "production" && isNullOrigin;

      if (
        !origin ||
        allowedOrigins.includes(normalizedOrigin) ||
        isLocalhostDevOrigin ||
        allowNullOriginInDev
      ) {
        return callback(null, true);
      }
      console.error(
        `CORS rejected origin: ${normalizedOrigin || "<empty>"}. Allowed origins: ${allowedOrigins.join(", ")}`
      );
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(attachCurrentUser);
app.use(ensureCsrfToken);

app.get("/setcookie", (req, res) => {
  res.cookie("mode", "light");
  res.cookie("location", "delhi");
  res.cookie("username", "samarth");
  return res.send("sent you a cookie successfully");
});

app.get("/greet", (req, res) => {
  const { username } = req.cookies;
  return res.send(`hi bro ${username || "anonymous"} hope you r doing good`);
});

app.get("/getsignedcookie", (req, res) => {
  res.cookie("earthquake", "aaya", { signed: true });
  return res.send("cookie sent successfully");
});

app.get("/showsigned", (req, res) => {
  return res.send(req.signedCookies);
});

app.get("/viewcount", (req, res) => {
  if (req.session.count) req.session.count += 1;
  else req.session.count = 1;

  return res.send(`You visited counter ${req.session.count} times`);
});

app.get("/setname", (req, res) => {
  req.session.username = "samarth vohra";
  return res.redirect("/greet-session");
});

app.get("/greet-session", (req, res) => {
  const { username = "anonymous" } = req.session;
  return res.send(`hi from ${username}`);
});

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/auth", verifyCsrfToken, authRoutes);
app.use("/api/products", productApiRoutes);
app.use("/products", verifyCsrfToken, productRoutes);

app.get("/", async (req, res) => {
  try {
    if (!res.locals.currentUser) {
      return res.render("home");
    }

    const userRole = res.locals.currentUser.role;
    if (userRole === "buyer") {
      const [featuredProducts, latestProducts] = await Promise.all([
        Product.find({ isAvailable: true }).sort({ createdAt: -1 }).limit(6),
        Product.find().sort({ createdAt: -1 }).limit(4),
      ]);

      return res.render("buyer_dashboard", { featuredProducts, latestProducts });
    }

    const ownerFilter = { owner: req.user.id };
    const [totalProducts, inStockProducts, featuredProducts] = await Promise.all([
      Product.countDocuments(ownerFilter),
      Product.countDocuments({ ...ownerFilter, isAvailable: true }),
      Product.find(ownerFilter).sort({ _id: -1 }).limit(4),
    ]);

    const outOfStockProducts = totalProducts - inStockProducts;
    const averagePrice =
      featuredProducts.length > 0
        ? Math.round(
            featuredProducts.reduce((sum, item) => sum + Number(item.price || 0), 0) /
              featuredProducts.length
          )
        : 0;

    return res.render("dashboard", {
      stats: {
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        averagePrice,
      },
      featuredProducts,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load dashboard" });
  }
});

app.get("/api/health", (req, res) => {
  return res.status(200).json({ message: "Inventory API is running" });
});

app.use((req, res) => {
  return res.status(404).render("error", { statusCode: 404, message: "Page not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  return res.status(err?.statusCode || 500).render("error", {
    statusCode: err?.statusCode || 500,
    message: err?.message || "Something went wrong",
  });
});

connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
