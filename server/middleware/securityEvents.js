const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const normalizeValue = (value) => {
  if (value === null || typeof value === "undefined") return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, 220);
};

export const logSecurityEvent = (req, event, details = {}) => {
  const payload = {
    event: normalizeValue(event) || "security_event",
    method: normalizeValue(req.method),
    path: normalizeValue(req.originalUrl || req.url),
    ip: normalizeValue(getClientIp(req)),
    userAgent: normalizeValue(req.headers["user-agent"]),
    ...details,
  };

  console.warn(`[SECURITY] ${JSON.stringify(payload)}`);
};

export default logSecurityEvent;
