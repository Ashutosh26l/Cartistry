import cors from "cors";

const PORT = process.env.PORT || 5500;

// Normalize origins so env-provided values and incoming request origins compare reliably.
const normalizeOrigin = (origin) => String(origin || "").trim().replace(/\/$/, "");
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`)
  .split(",")
  .map((item) => normalizeOrigin(item))
  .filter(Boolean);

export const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  const isNullOrigin = normalizedOrigin.toLowerCase() === "null";
  const isLocalhostDevOrigin =
    process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
  const allowNullOriginInDev = process.env.NODE_ENV !== "production" && isNullOrigin;

  return (
    !origin ||
    allowedOrigins.includes(normalizedOrigin) ||
    isLocalhostDevOrigin ||
    allowNullOriginInDev
  );
};

export const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    console.error(
      `CORS rejected origin: ${normalizedOrigin || "<empty>"}. Allowed origins: ${allowedOrigins.join(", ")}`
    );
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
