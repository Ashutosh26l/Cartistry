import mongoose from "mongoose";

const notificationHistorySchema = new mongoose.Schema(
  {
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    reviewIndex: { type: Number, required: true, min: 0 },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    replied: { type: Boolean, default: false, index: true },
    reply: { type: String, trim: true, default: "" },
    repliedBy: { type: String, trim: true, default: "" },
    repliedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "notificationHistory" }
);

notificationHistorySchema.index({ retailer: 1, createdAt: -1 });
notificationHistorySchema.index({ retailer: 1, isRead: 1, createdAt: -1 });
notificationHistorySchema.index({ retailer: 1, replied: 1, createdAt: -1 });
notificationHistorySchema.index({ retailer: 1, product: 1, reviewIndex: 1 }, { unique: true });

const NotificationHistory = mongoose.model("NotificationHistory", notificationHistorySchema);

export default NotificationHistory;
