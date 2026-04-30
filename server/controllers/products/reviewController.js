import Product from "../../models/productModel.js";
import NotificationHistory from "../../models/notificationHistoryModel.js";
import User from "../../models/userModel.js";
import { getRetailerPreference, shouldSendNotification } from "../../models/retailerPreferenceModel.js";
import { getOwnerFilter, getSafeRedirectPath } from "./productShared.js";
import {
  emitBuyerNotificationReplied,
  emitRetailerNotificationCreated,
  emitRetailerNotificationReplied,
  emitReviewCreated,
  emitReviewReplied,
} from "../../realtime/socketServer.js";

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

const getRetailerNotificationRedirect = (req, fallback) =>
  getSafeRedirectPath(req.body.redirectTo, fallback || "/products/notifications");

const markNotificationAsRead = async (notificationId, retailerId, fallbackFilter = {}) => {
  if (!notificationId) return null;
  return NotificationHistory.findOneAndUpdate(
    { _id: notificationId, retailer: retailerId, ...fallbackFilter },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
};

const enrichNotifications = async (notifications) => {
  const items = Array.isArray(notifications) ? notifications : [];
  if (items.length === 0) return [];

  const productIds = [...new Set(items.map((item) => String(item.product || "")).filter(Boolean))];
  const buyerIds = [...new Set(items.map((item) => String(item.buyer || "")).filter(Boolean))];

  const [products, buyers] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select("name reviews").lean(),
    User.find({ _id: { $in: buyerIds } }).select("name").lean(),
  ]);

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const buyerById = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));

  return items.map((item) => {
    const product = productById.get(String(item.product || ""));
    const review = Array.isArray(product?.reviews) ? product.reviews[item.reviewIndex] : null;
    const buyer = buyerById.get(String(item.buyer || ""));
    return {
      ...item,
      productName: product?.name || "Product unavailable",
      buyerName: buyer?.name || review?.userName || "Buyer",
      rating: Number(review?.rating || 0),
      comment: review?.comment || "Review unavailable",
      reviewCreatedAt: review?.createdAt || item.createdAt,
      reviewAvailable: Boolean(review),
    };
  });
};

export const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (res.locals.currentUser?.role !== "buyer") {
      req.flash("error", "Only buyers can add reviews");
      return res.redirect(`/products/${id}`);
    }

    const currentUserName = String(res.locals.currentUser?.name || "").trim();
    const parsedRating = Number(rating);

    if (!currentUserName || !comment || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      req.flash("error", "Please provide a valid review");
      return res.redirect(`/products/${id}`);
    }

    const normalizedComment = String(comment).trim();
    const updatedProduct = await Product.findOne({ _id: id });

    if (!updatedProduct) return res.status(403).send("Forbidden");

    updatedProduct.reviews.push({
      userName: currentUserName,
      rating: parsedRating,
      comment: normalizedComment,
      createdAt: new Date(),
    });
    await updatedProduct.save();

    const latestReviewIndex = Math.max(0, updatedProduct.reviews.length - 1);
    const preference = await getRetailerPreference(updatedProduct.owner);
    const allowInApp = shouldSendNotification(preference, {
      eventKey: "new_review",
      channel: "inApp",
      critical: true,
    });
    const allowEmail = shouldSendNotification(preference, {
      eventKey: "new_review",
      channel: "email",
      critical: true,
    });

    let createdNotification = null;
    if (allowInApp) {
      createdNotification = await NotificationHistory.create({
        retailer: updatedProduct.owner,
        buyer: req.user.id,
        product: updatedProduct._id,
        reviewIndex: latestReviewIndex,
        isRead: false,
      });
    }
    const latestReview = updatedProduct.reviews[latestReviewIndex];
    emitReviewCreated({
      productId: updatedProduct._id,
      reviewIndex: latestReviewIndex,
      review: {
        userName: latestReview.userName,
        rating: Number(latestReview.rating || 0),
        comment: latestReview.comment,
        createdAt: latestReview.createdAt,
      },
    });
    if (createdNotification) {
      emitRetailerNotificationCreated({
        retailerId: updatedProduct.owner,
        notification: {
          id: String(createdNotification._id),
          productId: String(updatedProduct._id),
          productName: updatedProduct.name || "Product unavailable",
          reviewIndex: latestReviewIndex,
          buyerName: currentUserName || "Buyer",
          rating: Number(latestReview.rating || 0),
          comment: latestReview.comment || "",
          reviewCreatedAt: latestReview.createdAt,
          createdAt: createdNotification.createdAt,
          replied: false,
          isRead: false,
          reviewAvailable: true,
          href: `/products/${updatedProduct._id}`,
        },
      });
    }

    if (allowEmail) {
      const retailer = await User.findById(updatedProduct.owner).select("email name");
      if (retailer?.email) {
        await sendEmailIfConfigured({
          to: retailer.email,
          subject: `New review pending reply: ${updatedProduct.name}`,
          text: `Buyer ${currentUserName} posted a ${parsedRating}/5 review on "${updatedProduct.name}". Please reply from your retailer notifications panel.`,
        });
      }
    }

    req.flash("success", "Review added successfully");
    return res.redirect(`/products/${id}`);
  } catch (error) {
    req.flash("error", "Unable to add review");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to add review" });
  }
};

export const replyToReview = async (req, res) => {
  try {
    const { id, reviewIndex } = req.params;
    const fallbackRedirect = `/products/${id}`;
    const safeRedirectPath = getRetailerNotificationRedirect(req, fallbackRedirect);
    const parsedIndex = Number(reviewIndex);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      req.flash("error", "Invalid review selected");
      return res.redirect(safeRedirectPath);
    }

    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });
    if (!product) {
      req.flash("error", "Retailer access only");
      return res.status(403).redirect("/products/allProducts");
    }

    if (!Array.isArray(product.reviews) || parsedIndex >= product.reviews.length) {
      req.flash("error", "Review not found");
      return res.redirect(safeRedirectPath);
    }

    const replyText = String(req.body.reply || "").trim();
    if (!replyText) {
      req.flash("error", "Reply cannot be empty");
      return res.redirect(safeRedirectPath);
    }

    product.reviews[parsedIndex].retailerReply = replyText;
    product.reviews[parsedIndex].repliedBy = String(res.locals.currentUser?.name || "Retailer").trim();
    product.reviews[parsedIndex].repliedAt = new Date();
    await product.save();
    emitReviewReplied({
      productId: product._id,
      reviewIndex: parsedIndex,
      reply: {
        reply: product.reviews[parsedIndex].retailerReply,
        repliedBy: product.reviews[parsedIndex].repliedBy,
        repliedAt: product.reviews[parsedIndex].repliedAt,
      },
    });
    const notificationFilter = {
      product: product._id,
      reviewIndex: parsedIndex,
    };
    const notificationPayload = {
      $set: {
        replied: true,
        reply: replyText,
        repliedBy: product.reviews[parsedIndex].repliedBy,
        repliedAt: product.reviews[parsedIndex].repliedAt,
        isRead: true,
        readAt: new Date(),
        buyerIsRead: false,
        buyerReadAt: null,
      },
    };
    const notificationId = String(req.body.notificationId || "").trim();
    let updatedNotification = null;
    if (notificationId) {
      updatedNotification = await NotificationHistory.findOneAndUpdate(
        { _id: notificationId, retailer: req.user.id, ...notificationFilter },
        notificationPayload,
        { new: true }
      );
    } else {
      updatedNotification = await NotificationHistory.findOneAndUpdate(
        { retailer: req.user.id, ...notificationFilter },
        notificationPayload,
        { sort: { createdAt: -1 }, new: true }
      );
    }
    if (updatedNotification) {
      emitRetailerNotificationReplied({
        retailerId: req.user.id,
        notification: {
          id: String(updatedNotification._id),
          productId: String(product._id),
          productName: product.name || "Product unavailable",
          reviewIndex: parsedIndex,
          buyerName: product.reviews[parsedIndex].userName || "Buyer",
          rating: Number(product.reviews[parsedIndex].rating || 0),
          comment: product.reviews[parsedIndex].comment || "",
          reviewCreatedAt: product.reviews[parsedIndex].createdAt,
          reply: replyText,
          repliedBy: product.reviews[parsedIndex].repliedBy,
          repliedAt: product.reviews[parsedIndex].repliedAt,
          createdAt: updatedNotification.createdAt,
          replied: true,
          isRead: true,
          href: `/products/${product._id}`,
        },
      });
      emitBuyerNotificationReplied({
        buyerId: updatedNotification.buyer,
        notification: {
          id: String(updatedNotification._id),
          productId: String(product._id),
          productName: product.name || "Product unavailable",
          reviewIndex: parsedIndex,
          buyerName: product.reviews[parsedIndex].userName || "Buyer",
          rating: Number(product.reviews[parsedIndex].rating || 0),
          comment: product.reviews[parsedIndex].comment || "",
          reviewCreatedAt: product.reviews[parsedIndex].createdAt,
          reply: replyText,
          repliedBy: product.reviews[parsedIndex].repliedBy,
          repliedAt: product.reviews[parsedIndex].repliedAt,
          createdAt: updatedNotification.createdAt,
          replied: true,
          buyerIsRead: false,
          href: `/products/${product._id}`,
        },
      });
    }

    req.flash("success", "Reply posted successfully.");
    return res.redirect(safeRedirectPath);
  } catch (error) {
    req.flash("error", "Unable to post reply");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to post reply" });
  }
};

export const getBuyerNotificationsPage = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const [newReplyNotificationsRaw, historyNotificationsRaw] = await Promise.all([
      NotificationHistory.find({ buyer: buyerId, replied: true, buyerIsRead: { $ne: true } })
        .sort({ repliedAt: -1, createdAt: -1 })
        .limit(50)
        .lean(),
      NotificationHistory.find({ buyer: buyerId, replied: true })
        .sort({ repliedAt: -1, createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const [newReplyNotifications, historyNotifications] = await Promise.all([
      enrichNotifications(newReplyNotificationsRaw),
      enrichNotifications(historyNotificationsRaw),
    ]);

    await NotificationHistory.updateMany(
      { buyer: buyerId, replied: true, buyerIsRead: { $ne: true } },
      { $set: { buyerIsRead: true, buyerReadAt: new Date() } }
    );

    return res.render("buyer_notifications", {
      newReplyNotifications,
      historyNotifications,
    });
  } catch (error) {
    return res.status(500).render("error", {
      statusCode: 500,
      message: "Unable to load buyer notifications",
    });
  }
};

export const getRetailerNotificationsPage = async (req, res) => {
  try {
    const retailerId = req.user.id;
    const [pendingNotificationsRaw, historyNotificationsRaw] = await Promise.all([
      NotificationHistory.find({ retailer: retailerId, replied: false }).sort({ createdAt: -1 }).limit(50).lean(),
      NotificationHistory.find({ retailer: retailerId, replied: true }).sort({ repliedAt: -1, createdAt: -1 }).limit(200).lean(),
    ]);
    const [pendingNotifications, historyNotifications] = await Promise.all([
      enrichNotifications(pendingNotificationsRaw),
      enrichNotifications(historyNotificationsRaw),
    ]);

    await NotificationHistory.updateMany(
      { retailer: retailerId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return res.render("retailer_notifications", {
      pendingNotifications,
      historyNotifications,
    });
  } catch (error) {
    return res.status(500).render("error", {
      statusCode: 500,
      message: "Unable to load retailer notifications",
    });
  }
};

export const markRetailerNotificationRead = async (req, res) => {
  try {
    const notificationId = String(req.params.notificationId || "").trim();
    const safeRedirectPath = getRetailerNotificationRedirect(req, "/products/notifications");
    if (!notificationId) {
      req.flash("error", "Notification not found");
      return res.redirect(safeRedirectPath);
    }

    const notification = await markNotificationAsRead(notificationId, req.user.id);
    if (!notification) {
      req.flash("error", "Notification not found");
      return res.redirect(safeRedirectPath);
    }

    req.flash("success", "Notification marked as read");
    return res.redirect(safeRedirectPath);
  } catch (error) {
    req.flash("error", "Unable to update notification");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update notification" });
  }
};
