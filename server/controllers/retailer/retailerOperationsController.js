import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import RetailerEvent from "../../models/retailerEventModel.js";
import NotificationHistory from "../../models/notificationHistoryModel.js";
import { getRetailerPreference, shouldSendNotification } from "../../models/retailerPreferenceModel.js";

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
};

const parseCsvText = (csvText) => {
  const raw = String(csvText || "").replace(/\r/g, "").trim();
  if (!raw) return [];
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = [];
  for (let lineNumber = 1; lineNumber < lines.length; lineNumber += 1) {
    const values = parseCsvLine(lines[lineNumber]);
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || "";
    });
    rows.push({ lineNumber: lineNumber + 1, row });
  }
  return rows;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProductRow = (row) => {
  const name = String(row.name || "").trim();
  const description = String(row.description || "").trim();
  const category = String(row.category || "").trim();
  const brand = String(row.brand || "").trim();
  const dateCreated = Math.max(0, Math.round(toNumber(row.datecreated, Date.now())));
  const warranty = Math.max(0, toNumber(row.warranty, 0));
  const price = Math.max(0, toNumber(row.price, 0));
  const quantity = Math.max(0, Math.round(toNumber(row.quantity, 0)));
  const image = String(row.image || "").trim();
  const variantSizes = String(row.variantsizes || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const variantColors = String(row.variantcolors || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    name,
    description,
    category,
    brand,
    dateCreated,
    warranty,
    price,
    quantity,
    image,
    variants: {
      sizes: variantSizes,
      colors: variantColors,
    },
  };
};

const validateNormalizedRow = (payload) => {
  const errors = [];
  if (!payload.name || payload.name.length < 2) errors.push("name must be at least 2 characters");
  if (!Number.isFinite(payload.price) || payload.price < 0) errors.push("price must be >= 0");
  if (!Number.isFinite(payload.quantity) || payload.quantity < 0) errors.push("quantity must be >= 0");
  if (!Number.isFinite(payload.warranty) || payload.warranty < 0) errors.push("warranty must be >= 0");
  return errors;
};

const getRangeStartDate = (range) => {
  const now = new Date();
  const value = String(range || "30d").trim();
  const map = { "7d": 7, "30d": 30, "90d": 90 };
  const days = map[value] || 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

const getAnalyticsBundle = async (retailerId, range = "30d") => {
  const startDate = getRangeStartDate(range);
  const orderMatch = { retailer: retailerId, status: "placed", placedAt: { $gte: startDate } };
  const eventMatch = { retailer: retailerId, occurredAt: { $gte: startDate } };

  const [salesAgg, orderCount, topProducts, productViews, purchases, pendingReplies, salesTrend] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: null, sales: { $sum: "$grandTotal" } } },
    ]),
    Order.countDocuments(orderMatch),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          productName: { $first: "$items.nameSnapshot" },
          revenue: { $sum: "$items.lineTotal" },
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    RetailerEvent.countDocuments({ ...eventMatch, eventType: "product_view" }),
    RetailerEvent.countDocuments({ ...eventMatch, eventType: "purchase_success" }),
    NotificationHistory.countDocuments({ retailer: retailerId, replied: false }),
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: {
            year: { $year: "$placedAt" },
            month: { $month: "$placedAt" },
            day: { $dayOfMonth: "$placedAt" },
          },
          total: { $sum: "$grandTotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]),
  ]);

  const sales = Number(salesAgg?.[0]?.sales || 0);
  const conversionRate = productViews > 0 ? (purchases / productViews) * 100 : 0;
  const aov = orderCount > 0 ? sales / orderCount : 0;

  return {
    range,
    sales,
    orders: orderCount,
    aov,
    conversionRate,
    pendingReplies,
    topProducts: topProducts.map((item) => ({
      productId: String(item._id || ""),
      productName: item.productName || "Unknown",
      revenue: Number(item.revenue || 0),
      quantity: Number(item.quantity || 0),
    })),
    trend: salesTrend.map((item) => ({
      label: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
      total: Number(item.total || 0),
      orders: Number(item.orders || 0),
    })),
    productViews,
    purchases,
  };
};

const sendEmailIfConfigured = async ({ to, subject, text }) => {
  try {
    const smtpHost = String(process.env.SMTP_HOST || "").trim();
    const smtpPort = Number(process.env.SMTP_PORT || 0);
    const smtpUser = String(process.env.SMTP_USER || "").trim();
    const smtpPass = String(process.env.SMTP_PASS || "").trim();
    const smtpFrom = String(process.env.SMTP_FROM || "").trim();
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !to) return false;

    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
    });
    return true;
  } catch (error) {
    return false;
  }
};

const parseSelectionIds = (input) => {
  if (Array.isArray(input)) return input.map((item) => String(item || "").trim()).filter(Boolean);
  return String(input || "")
    .split(/[\s,]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildBulkEditPreviewItem = (product, operation, value) => {
  const before = {
    price: Number(product.price || 0),
    quantity: Number(product.quantity || 0),
    category: String(product.category || ""),
    brand: String(product.brand || ""),
    isAvailable: Boolean(product.isAvailable),
  };
  const after = { ...before };

  if (operation === "price_percent") {
    const percent = Number(value || 0);
    after.price = Math.max(0, Number((before.price * (1 + percent / 100)).toFixed(2)));
  } else if (operation === "price_fixed") {
    const delta = Number(value || 0);
    after.price = Math.max(0, Number((before.price + delta).toFixed(2)));
  } else if (operation === "set_category") {
    after.category = String(value || "").trim();
  } else if (operation === "set_brand") {
    after.brand = String(value || "").trim();
  } else if (operation === "set_availability") {
    const enabled = String(value || "").toLowerCase() === "true";
    after.isAvailable = enabled;
    if (!enabled) after.quantity = 0;
    if (enabled && after.quantity <= 0) after.quantity = 1;
  } else if (operation === "set_quantity") {
    after.quantity = Math.max(0, Math.round(Number(value || 0)));
    after.isAvailable = after.quantity > 0;
  }

  return { before, after };
};

const applyBulkEdit = (product, operation, value) => {
  const next = buildBulkEditPreviewItem(product, operation, value).after;
  product.price = next.price;
  product.quantity = next.quantity;
  product.category = next.category;
  product.brand = next.brand;
  product.isAvailable = next.isAvailable;
};

export const getRetailerAnalyticsPage = async (req, res) => {
  try {
    const range = String(req.query.range || "30d").trim();
    const analytics = await getAnalyticsBundle(req.user.id, range);
    return res.render("retailer_analytics", { analytics });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load analytics" });
  }
};

export const getRetailerAnalyticsOverviewApi = async (req, res) => {
  try {
    const range = String(req.query.range || "30d").trim();
    const analytics = await getAnalyticsBundle(req.user.id, range);
    return res.status(200).json({
      range: analytics.range,
      sales: analytics.sales,
      orders: analytics.orders,
      aov: analytics.aov,
      conversionRate: analytics.conversionRate,
      pendingReplies: analytics.pendingReplies,
      trend: analytics.trend,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load analytics overview" });
  }
};

export const getRetailerTopProductsApi = async (req, res) => {
  try {
    const range = String(req.query.range || "30d").trim();
    const analytics = await getAnalyticsBundle(req.user.id, range);
    return res.status(200).json({ range: analytics.range, topProducts: analytics.topProducts });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load top products" });
  }
};

export const getRetailerConversionApi = async (req, res) => {
  try {
    const range = String(req.query.range || "30d").trim();
    const analytics = await getAnalyticsBundle(req.user.id, range);
    return res.status(200).json({
      range: analytics.range,
      productViews: analytics.productViews,
      purchases: analytics.purchases,
      conversionRate: analytics.conversionRate,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load conversion metrics" });
  }
};

export const getBulkUploadPage = async (req, res) => {
  return res.render("retailer_bulk_upload", {
    csvText: "",
    mode: "upsert_by_name_brand",
    preview: null,
  });
};

export const downloadBulkCsvTemplate = (req, res) => {
  const template = [
    "name,description,category,brand,dateCreated,warranty,price,quantity,image,variantSizes,variantColors",
    "Phone X,Latest model phone,Electronics,Tri,2026,1,15999,25,https://example.com/image.jpg,64GB|128GB,Black|Blue",
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="retailer-products-template.csv"');
  return res.status(200).send(template);
};

export const previewBulkUpload = async (req, res) => {
  try {
    const csvText = String(req.body.csvText || "");
    const mode = String(req.body.mode || "upsert_by_name_brand");
    const parsedRows = parseCsvText(csvText).slice(0, 2000);
    const errors = [];
    const validRows = [];

    parsedRows.forEach(({ lineNumber, row }) => {
      const normalized = normalizeProductRow(row);
      const rowErrors = validateNormalizedRow(normalized);
      if (rowErrors.length > 0) {
        errors.push({ lineNumber, message: rowErrors.join(", ") });
        return;
      }
      validRows.push({ lineNumber, payload: normalized });
    });

    const preview = {
      mode,
      totalRows: parsedRows.length,
      validCount: validRows.length,
      invalidCount: errors.length,
      errors: errors.slice(0, 50),
      sampleValidRows: validRows.slice(0, 10),
    };

    return res.render("retailer_bulk_upload", { csvText, mode, preview });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to preview CSV upload" });
  }
};

export const commitBulkUpload = async (req, res) => {
  try {
    const csvText = String(req.body.csvText || "");
    const mode = String(req.body.mode || "upsert_by_name_brand");
    const parsedRows = parseCsvText(csvText).slice(0, 2000);
    const errors = [];
    const validRows = [];

    parsedRows.forEach(({ lineNumber, row }) => {
      const normalized = normalizeProductRow(row);
      const rowErrors = validateNormalizedRow(normalized);
      if (rowErrors.length > 0) {
        errors.push({ lineNumber, message: rowErrors.join(", ") });
        return;
      }
      validRows.push({ lineNumber, payload: normalized });
    });

    if (validRows.length === 0) {
      const preview = {
        mode,
        totalRows: parsedRows.length,
        validCount: 0,
        invalidCount: errors.length,
        errors: errors.slice(0, 50),
        sampleValidRows: [],
      };
      return res.render("retailer_bulk_upload", { csvText, mode, preview });
    }

    let created = 0;
    let updated = 0;
    for (const item of validRows) {
      const payload = item.payload;
      if (mode === "create_only") {
        const existing = await Product.findOne({
          owner: req.user.id,
          name: payload.name,
          brand: payload.brand,
        });
        if (existing) {
          errors.push({ lineNumber: item.lineNumber, message: "product already exists for create_only mode" });
          continue;
        }
        await Product.create({ ...payload, owner: req.user.id });
        created += 1;
        continue;
      }

      const existing = await Product.findOne({
        owner: req.user.id,
        name: payload.name,
        brand: payload.brand,
      });
      if (!existing) {
        await Product.create({ ...payload, owner: req.user.id });
        created += 1;
      } else {
        Object.assign(existing, payload);
        await existing.save();
        updated += 1;
      }
    }

    const preview = {
      mode,
      totalRows: parsedRows.length,
      validCount: validRows.length,
      invalidCount: errors.length,
      errors: errors.slice(0, 50),
      sampleValidRows: validRows.slice(0, 10),
      commitSummary: { created, updated },
    };

    const [preference, retailer] = await Promise.all([
      getRetailerPreference(req.user.id),
      User.findById(req.user.id).select("email"),
    ]);
    const allowEmail = shouldSendNotification(preference, {
      eventKey: "csv_import_summary",
      channel: "email",
      critical: true,
    });
    if (allowEmail && retailer?.email) {
      await sendEmailIfConfigured({
        to: retailer.email,
        subject: "CSV import summary",
        text: `CSV import completed. Created: ${created}, Updated: ${updated}, Errors: ${errors.length}.`,
      });
    }

    req.flash("success", `Bulk upload complete. Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`);
    return res.render("retailer_bulk_upload", { csvText, mode, preview });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to commit CSV upload" });
  }
};

export const getBulkEditPage = async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user.id }).sort({ createdAt: -1 }).limit(200);
    return res.render("retailer_bulk_edit", {
      products,
      previewRows: [],
      operation: "price_percent",
      operationValue: "",
      selectedIds: [],
    });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load bulk edit page" });
  }
};

export const previewBulkEdit = async (req, res) => {
  try {
    const selectedIds = parseSelectionIds(req.body.selectedIds);
    const operation = String(req.body.operation || "price_percent");
    const operationValue = String(req.body.operationValue || "");
    const products = await Product.find({ owner: req.user.id }).sort({ createdAt: -1 }).limit(200);
    const selectedProducts = await Product.find({
      owner: req.user.id,
      _id: { $in: selectedIds },
    }).limit(500);

    const previewRows = selectedProducts.map((product) => ({
      product,
      ...buildBulkEditPreviewItem(product, operation, operationValue),
    }));

    return res.render("retailer_bulk_edit", {
      products,
      previewRows,
      operation,
      operationValue,
      selectedIds,
    });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to preview bulk edit" });
  }
};

export const applyBulkEditChanges = async (req, res) => {
  try {
    const selectedIds = parseSelectionIds(req.body.selectedIds);
    const operation = String(req.body.operation || "price_percent");
    const operationValue = String(req.body.operationValue || "");
    const selectedProducts = await Product.find({
      owner: req.user.id,
      _id: { $in: selectedIds },
    }).limit(500);

    for (const product of selectedProducts) {
      applyBulkEdit(product, operation, operationValue);
      await product.save();
    }

    req.flash("success", `Bulk edit applied on ${selectedProducts.length} product(s).`);
    return res.redirect("/retailer/bulk/edit");
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to apply bulk edit" });
  }
};

export const getNotificationPreferencesPage = async (req, res) => {
  try {
    const preference = await getRetailerPreference(req.user.id);
    return res.render("retailer_notification_preferences", { preference });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load notification preferences" });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const preference = await getRetailerPreference(req.user.id);
    preference.channels.inApp = Boolean(req.body.channelInApp === "on");
    preference.channels.email = Boolean(req.body.channelEmail === "on");
    preference.criticalOnly = Boolean(req.body.criticalOnly === "on");
    preference.eventToggles.lowStock = Boolean(req.body.eventLowStock === "on");
    preference.eventToggles.newReview = Boolean(req.body.eventNewReview === "on");
    preference.eventToggles.csvImportSummary = Boolean(req.body.eventCsvImportSummary === "on");
    preference.eventToggles.securityAlert = Boolean(req.body.eventSecurityAlert === "on");
    preference.lowStockThreshold = Math.max(1, Math.min(100, Number(req.body.lowStockThreshold || 5)));
    await preference.save();

    req.flash("success", "Notification preferences saved.");
    return res.redirect("/retailer/notification-preferences");
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update notification preferences" });
  }
};

export const getNotificationPreferencesApi = async (req, res) => {
  try {
    const preference = await getRetailerPreference(req.user.id);
    return res.status(200).json(preference);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load preferences" });
  }
};

export const patchNotificationPreferencesApi = async (req, res) => {
  try {
    const preference = await getRetailerPreference(req.user.id);
    const payload = req.body || {};
    if (payload.channels && typeof payload.channels === "object") {
      if (typeof payload.channels.inApp === "boolean") preference.channels.inApp = payload.channels.inApp;
      if (typeof payload.channels.email === "boolean") preference.channels.email = payload.channels.email;
    }
    if (typeof payload.criticalOnly === "boolean") preference.criticalOnly = payload.criticalOnly;
    if (payload.eventToggles && typeof payload.eventToggles === "object") {
      if (typeof payload.eventToggles.lowStock === "boolean")
        preference.eventToggles.lowStock = payload.eventToggles.lowStock;
      if (typeof payload.eventToggles.newReview === "boolean")
        preference.eventToggles.newReview = payload.eventToggles.newReview;
      if (typeof payload.eventToggles.csvImportSummary === "boolean")
        preference.eventToggles.csvImportSummary = payload.eventToggles.csvImportSummary;
      if (typeof payload.eventToggles.securityAlert === "boolean")
        preference.eventToggles.securityAlert = payload.eventToggles.securityAlert;
    }
    if (typeof payload.lowStockThreshold === "number") {
      preference.lowStockThreshold = Math.max(1, Math.min(100, Number(payload.lowStockThreshold)));
    }
    await preference.save();
    return res.status(200).json(preference);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update preferences" });
  }
};

export const ensureRetailerPreferencesRecord = async (req, res, next) => {
  try {
    await getRetailerPreference(req.user.id);
    return next();
  } catch (error) {
    return next();
  }
};
