import mongoose from "mongoose";

const retailerEventSchema = new mongoose.Schema(
  {
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    eventType: {
      type: String,
      enum: ["product_view", "add_to_cart", "buy_now_start", "purchase_success"],
      required: true,
      index: true,
    },
    sessionId: { type: String, trim: true, default: "" },
    occurredAt: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

retailerEventSchema.index({ retailer: 1, eventType: 1, occurredAt: -1 });
retailerEventSchema.index({ retailer: 1, product: 1, occurredAt: -1 });

const RetailerEvent = mongoose.model("RetailerEvent", retailerEventSchema);

export default RetailerEvent;

