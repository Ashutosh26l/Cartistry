import mongoose from "mongoose";

const retailerPreferenceSchema = new mongoose.Schema(
  {
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    criticalOnly: { type: Boolean, default: false },
    eventToggles: {
      lowStock: { type: Boolean, default: true },
      newReview: { type: Boolean, default: true },
      csvImportSummary: { type: Boolean, default: true },
      securityAlert: { type: Boolean, default: true },
    },
    lowStockThreshold: { type: Number, min: 1, max: 100, default: 5 },
    emailDigest: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ["instant", "daily"], default: "instant" },
    },
  },
  { timestamps: true }
);

const RetailerPreference = mongoose.model("RetailerPreference", retailerPreferenceSchema);

const eventToToggleKey = {
  low_stock: "lowStock",
  new_review: "newReview",
  csv_import_summary: "csvImportSummary",
  security_alert: "securityAlert",
};

const getRetailerPreference = async (retailerId) => {
  if (!retailerId) return null;
  let preference = await RetailerPreference.findOne({ retailer: retailerId });
  if (!preference) {
    preference = await RetailerPreference.create({ retailer: retailerId });
  }
  return preference;
};

const isEventEnabled = (preference, eventKey) => {
  const toggleKey = eventToToggleKey[eventKey];
  if (!toggleKey) return true;
  if (!preference?.eventToggles) return true;
  return Boolean(preference.eventToggles[toggleKey]);
};

const shouldSendNotification = (preference, options = {}) => {
  const { eventKey = "", channel = "inApp", critical = false } = options;
  if (!preference) {
    return channel === "inApp";
  }
  if (preference.criticalOnly && !critical) return false;
  if (!isEventEnabled(preference, eventKey)) return false;
  if (channel === "email") return Boolean(preference.channels?.email);
  return Boolean(preference.channels?.inApp);
};

export { getRetailerPreference, shouldSendNotification };
export default RetailerPreference;

