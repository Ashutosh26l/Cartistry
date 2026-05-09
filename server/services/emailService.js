import nodemailer from "nodemailer";

const asBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
};

const getTransporter = () => {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: asBool(process.env.SMTP_SECURE, false),
    auth: { user, pass },
  });
};

const getRetailerWelcomeTemplate = ({ name }) => ({
  subject: "Welcome Retail Partner",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Welcome, ${name}!</h2>
      <p>Your retailer account is now active.</p>
      <p>You can now list products, manage inventory, and track orders from your dashboard.</p>
      <p>We're excited to have you as a retail partner.</p>
    </div>
  `,
});

const getBuyerWelcomeTemplate = ({ name }) => ({
  subject: "Welcome to Our Store",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Welcome, ${name}!</h2>
      <p>Your account has been created successfully.</p>
      <p>You can now explore products, save favorites, and place orders.</p>
      <p>Happy shopping.</p>
    </div>
  `,
});

const getWelcomeTemplate = ({ name, role }) => {
  if (role === "retailer") return getRetailerWelcomeTemplate({ name });
  return getBuyerWelcomeTemplate({ name });
};

export const sendWelcomeEmail = async ({ to, name, role }) => {
  const transporter = getTransporter();
  if (!transporter) {
    return { skipped: true, reason: "smtp_not_configured" };
  }

  const template = getWelcomeTemplate({ name, role });
  await transporter.sendMail({
    from: String(process.env.MAIL_FROM || process.env.SMTP_USER || "").trim(),
    to,
    subject: template.subject,
    html: template.html,
  });

  return { skipped: false };
};
