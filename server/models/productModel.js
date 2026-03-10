import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    retailerReply: { type: String, trim: true, default: "" },
    repliedBy: { type: String, trim: true, default: "" },
    repliedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: false, default: "" },
  category: { type: String, required: false, default: "", trim: true, index: true },
  brand: { type: String, required: false, default: "", trim: true, index: true },
  dateCreated: { type: Number, required: true },
  warranty: { type: Number, required: true },
  price: { type: Number, required: true },
  isAvailable: { type: Boolean, required: true, default: true },
  quantity: { type: Number, default: 0, min: 0 },
  stockStatus: {
    type: String,
    enum: ["In Stock", "Out of Stock"],
    default: "Out of Stock",
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  image: { type: String, required: false },
  images: { type: [String], default: [] },
  variants: {
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
  },
  reviews: { type: [reviewSchema], default: [] },
});

productSchema.index({ name: "text", description: "text", category: "text", brand: "text" });

productSchema.pre("validate", function setStockStatus() {
  const qty = Number(this.quantity || 0);
  this.stockStatus = qty <= 0 ? "Out of Stock" : "In Stock";
  this.isAvailable = qty > 0;
});

productSchema.post("findOneAndDelete", async function cleanupReviews(doc) {
  if (!doc) return;
  doc.reviews = [];
});

const Product = mongoose.model("Product", productSchema);

export default Product;
