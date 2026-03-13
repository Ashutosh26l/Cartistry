import Product from "../models/productModel.js";
import NotificationHistory from "../models/notificationHistoryModel.js";
import User from "../models/userModel.js";

// Home route serves a role-based dashboard for logged-in users.
export const renderHome = async (req, res) => {
  try {
    if (!res.locals.currentUser) {
      return res.render("home");
    }

    const userRole = res.locals.currentUser.role;
    if (userRole === "buyer") {
      const [featuredProducts, latestProducts] = await Promise.all([
        Product.find({ isAvailable: true }).sort({ createdAt: -1 }).limit(6),
        Product.find().sort({ createdAt: -1 }).limit(4),
      ]);

      return res.render("buyer_dashboard", { featuredProducts, latestProducts });
    }

    const ownerFilter = { owner: req.user.id };
    const [totalProducts, inStockProducts, featuredProducts, pendingNotifications, latestHistoryRaw] = await Promise.all([
      Product.countDocuments(ownerFilter),
      Product.countDocuments({ ...ownerFilter, isAvailable: true }),
      Product.find(ownerFilter).sort({ _id: -1 }).limit(4),
      NotificationHistory.countDocuments({ retailer: req.user.id, replied: false }),
      NotificationHistory.find({ retailer: req.user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const latestProductIds = [...new Set(latestHistoryRaw.map((item) => String(item.product || "")).filter(Boolean))];
    const latestBuyerIds = [...new Set(latestHistoryRaw.map((item) => String(item.buyer || "")).filter(Boolean))];
    const [latestProducts, latestBuyers] = await Promise.all([
      Product.find({ _id: { $in: latestProductIds } }).select("name reviews").lean(),
      User.find({ _id: { $in: latestBuyerIds } }).select("name").lean(),
    ]);
    const latestProductById = new Map(latestProducts.map((product) => [String(product._id), product]));
    const latestBuyerById = new Map(latestBuyers.map((buyer) => [String(buyer._id), buyer]));
    const latestHistory = latestHistoryRaw.map((item) => {
      const product = latestProductById.get(String(item.product || ""));
      const review = Array.isArray(product?.reviews) ? product.reviews[item.reviewIndex] : null;
      const buyer = latestBuyerById.get(String(item.buyer || ""));
      return {
        ...item,
        productName: product?.name || "Product unavailable",
        buyerName: buyer?.name || review?.userName || "Buyer",
        comment: review?.comment || "Review unavailable",
      };
    });

    const outOfStockProducts = totalProducts - inStockProducts;
    const averagePrice =
      featuredProducts.length > 0
        ? Math.round(
            featuredProducts.reduce((sum, item) => sum + Number(item.price || 0), 0) /
              featuredProducts.length
          )
        : 0;

    return res.render("dashboard", {
      stats: {
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        averagePrice,
        pendingNotifications,
      },
      featuredProducts,
      latestNotifications: latestHistory,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load dashboard" });
  }
};

export const getApiHealth = (req, res) => {
  return res.status(200).json({ message: "Inventory API is running" });
};

export const getHealth = (req, res) => {
  return res.status(200).json({ ok: true, uptime: process.uptime() });
};

export const renderHelpCenter = (req, res) => {
  return res.render("help_center");
};

export const renderReturns = (req, res) => {
  return res.render("returns");
};

export const renderShipping = (req, res) => {
  return res.render("shipping");
};
