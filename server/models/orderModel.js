import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    nameSnapshot: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    addressLine1: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["placed", "cancelled", "refunded"],
      default: "placed",
      index: true,
    },
    placedAt: { type: Date, default: Date.now, index: true },
    paymentMethod: { type: String, trim: true, default: "" },
    shippingAddressSnapshot: { type: shippingAddressSchema, default: () => ({}) },
  },
  { timestamps: true }
);

orderSchema.index({ retailer: 1, placedAt: -1 });
orderSchema.index({ retailer: 1, status: 1, placedAt: -1 });
orderSchema.index({ "items.product": 1, placedAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;

