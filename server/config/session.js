// Session config used by express-session middleware.
const isProduction = process.env.NODE_ENV === "production";
const MIN_SECRET_LENGTH = 32;
const WEAK_PLACEHOLDER_VALUES = new Set([
  "replace_with_a_long_random_session_secret",
  "replace_with_a_long_random_cookie_secret",
]);

const resolveSessionSecret = () => {
  const rawSecret = String(process.env.SESSION_SECRET || "").trim();
  const isWeak = !rawSecret || rawSecret.length < MIN_SECRET_LENGTH || WEAK_PLACEHOLDER_VALUES.has(rawSecret);

  if (isProduction && isWeak) {
    throw new Error("SESSION_SECRET must be a strong random value in production (32+ chars).");
  }

  if (isWeak) {
    console.warn(
      "Weak SESSION_SECRET detected for development. Use a strong 32+ character secret before production deployment."
    );
  }

  return rawSecret || "development-only-insecure-session-secret";
};

export const sessionConfig = {
  secret: resolveSessionSecret(),
  resave: false,
  saveUninitialized: false,
  name: "sid",
  unset: "destroy",
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
};

export default sessionConfig;
