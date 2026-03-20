import NotificationHistory from "../models/notificationHistoryModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";

const PREVIEW_LIMIT = 6;

const toObjectIdString = (value) => String(value || "");

const getProductsMap = async (notifications) => {
  const productIds = [...new Set(notifications.map((item) => toObjectIdString(item.product)).filter(Boolean))];
  if (productIds.length === 0) return new Map();
  const products = await Product.find({ _id: { $in: productIds } }).select("name reviews").lean();
  return new Map(products.map((item) => [toObjectIdString(item._id), item]));
};

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

    const productsMapPromise = getProductsMap(latestNotifications);
    const buyerIds = [...new Set(latestNotifications.map((item) => toObjectIdString(item.buyer)).filter(Boolean))];
    const buyersPromise =
      buyerIds.length > 0
        ? User.find({ _id: { $in: buyerIds } }).select("name").lean()
        : Promise.resolve([]);

    const [productById, buyers] = await Promise.all([productsMapPromise, buyersPromise]);
    const buyerById = new Map(buyers.map((item) => [toObjectIdString(item._id), item]));
    const previewItems = latestNotifications.map((item) => {
      const product = productById.get(toObjectIdString(item.product));
      const review = Array.isArray(product?.reviews) ? product.reviews[item.reviewIndex] : null;
      const buyer = buyerById.get(toObjectIdString(item.buyer));
      const productName = product?.name || "Product unavailable";
      const buyerName = buyer?.name || review?.userName || "Buyer";
      const comment = review?.comment || "Review unavailable";

      return {
        id: toObjectIdString(item._id),
        productId: toObjectIdString(item.product),
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

export const attachBuyerNotificationCount = async (req, res, next) => {
  try {
    const role = res.locals.currentUser?.role;
    const isBuyer = role === "buyer";
    if (!isBuyer || !req.user?.id) {
      res.locals.buyerNotificationUnreadCount = 0;
      res.locals.buyerNotificationPreview = [];
      return next();
    }

    const buyerId = req.user.id;
    const [unreadCount, latestNotifications] = await Promise.all([
      NotificationHistory.countDocuments({
        buyer: buyerId,
        replied: true,
        buyerIsRead: { $ne: true },
      }),
      NotificationHistory.find({ buyer: buyerId, replied: true })
        .sort({ repliedAt: -1, createdAt: -1 })
        .limit(PREVIEW_LIMIT)
        .lean(),
    ]);

    const productById = await getProductsMap(latestNotifications);
    const previewItems = latestNotifications.map((item) => {
      const product = productById.get(toObjectIdString(item.product));
      const review = Array.isArray(product?.reviews) ? product.reviews[item.reviewIndex] : null;
      const productName = product?.name || "Product unavailable";

      return {
        id: toObjectIdString(item._id),
        productId: toObjectIdString(item.product),
        productName,
        comment: review?.comment || "Review unavailable",
        reply: item.reply || "",
        repliedBy: item.repliedBy || "Retailer",
        repliedAt: item.repliedAt || null,
        buyerIsRead: Boolean(item.buyerIsRead),
        href: item.product ? `/products/${item.product}` : "/products/my-notifications",
      };
    });

    res.locals.buyerNotificationUnreadCount = unreadCount;
    res.locals.buyerNotificationPreview = previewItems;
    return next();
  } catch (error) {
    res.locals.buyerNotificationUnreadCount = 0;
    res.locals.buyerNotificationPreview = [];
    return next();
  }
};

export default attachRetailerNotificationCount;
