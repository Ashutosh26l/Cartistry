import NotificationHistory from "../models/notificationHistoryModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";

const PREVIEW_LIMIT = 6;

export const attachRetailerNotificationCount = async (req, res, next) => {
  try {
    const role = res.locals.currentUser?.role;
    const isRetailer = role === "retailer" || role === "admin";
    if (!isRetailer || !req.user?.id) {
      res.locals.retailerNotificationUnreadCount = 0;
      res.locals.retailerNotificationPreview = [];
      return next();
    }

    const retailerId = req.user.id;
    const [unreadCount, latestNotifications] = await Promise.all([
      NotificationHistory.countDocuments({
        retailer: retailerId,
        isRead: false,
        replied: false,
      }),
      NotificationHistory.find({ retailer: retailerId })
        .sort({ createdAt: -1 })
        .limit(PREVIEW_LIMIT)
        .lean(),
    ]);

    const productIds = [...new Set(latestNotifications.map((item) => String(item.product || "")).filter(Boolean))];
    const buyerIds = [...new Set(latestNotifications.map((item) => String(item.buyer || "")).filter(Boolean))];

    const [products, buyers] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select("name reviews").lean(),
      User.find({ _id: { $in: buyerIds } }).select("name").lean(),
    ]);
    const productById = new Map(products.map((item) => [String(item._id), item]));
    const buyerById = new Map(buyers.map((item) => [String(item._id), item]));
    const previewItems = latestNotifications.map((item) => {
      const product = productById.get(String(item.product || ""));
      const review = Array.isArray(product?.reviews) ? product.reviews[item.reviewIndex] : null;
      const buyer = buyerById.get(String(item.buyer || ""));
      const productName = product?.name || "Product unavailable";
      const buyerName = buyer?.name || review?.userName || "Buyer";
      const comment = review?.comment || "Review unavailable";

      return {
        id: String(item._id),
        productId: String(item.product || ""),
        productName,
        buyerName,
        comment,
        createdAt: item.createdAt,
        replied: Boolean(item.replied),
        href: item.product ? `/products/${item.product}` : "/products/notifications",
      };
    });

    res.locals.retailerNotificationUnreadCount = unreadCount;
    res.locals.retailerNotificationPreview = previewItems;
    return next();
  } catch (error) {
    res.locals.retailerNotificationUnreadCount = 0;
    res.locals.retailerNotificationPreview = [];
    return next();
  }
};

export default attachRetailerNotificationCount;
