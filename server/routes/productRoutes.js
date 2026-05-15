import express from "express";
import {
  addToCart,
  addProductReview,
  buyNow,
  createProductPage,
  deleteProductPage,
  getCartPage,
  getBuyNowPage,
  getAddProductPage,
  getAllProductsPage,
  getBuyerOrdersPage,
  getBuyerNotificationsPage,
  getWishlistPage,
  getEditProductPage,
  getRetailerNotificationsPage,
  getProductDetailPage,
  markRetailerNotificationRead,
  removeCartItem,
  replyToReview,
  startBuyNow,
  toggleWishlist,
  updateCartItemQuantity,
  updateProductPage,
} from "../controllers/productController.js";
import { requireAuthPage, requireBuyerPage, requireRetailerPage } from "../middleware/auth.js";
import {
  cartCheckoutRateLimiter,
  publicReadRateLimiter,
  writeRateLimiter,
} from "../middleware/rateLimit.js";
import { validateProduct, validateReview, validateReviewReply } from "../middleware/validation.js";

const router = express.Router();

router.use(requireAuthPage);

router.get("/allProducts", publicReadRateLimiter, getAllProductsPage);
router.get("/notifications", requireRetailerPage, getRetailerNotificationsPage);
router.get("/my-notifications", requireBuyerPage, getBuyerNotificationsPage);
router.post("/notifications/:notificationId/read", writeRateLimiter, requireRetailerPage, markRetailerNotificationRead);
router.post("/:id/reviews", writeRateLimiter, requireBuyerPage, validateReview, addProductReview);
router.post("/:id/reviews/:reviewIndex/reply", writeRateLimiter, requireRetailerPage, validateReviewReply, replyToReview);
router.get("/new", requireRetailerPage, getAddProductPage);
router.post("/new", writeRateLimiter, requireRetailerPage, validateProduct, createProductPage);
router.get("/edit/:id", requireRetailerPage, getEditProductPage);
router.post("/edit/:id", writeRateLimiter, requireRetailerPage, validateProduct, updateProductPage);
router.post("/:id/delete", writeRateLimiter, requireRetailerPage, deleteProductPage);
router.get("/cart", requireBuyerPage, getCartPage);
router.get("/orders", requireBuyerPage, getBuyerOrdersPage);
router.get("/wishlist", requireBuyerPage, getWishlistPage);
router.post("/:id/cart", cartCheckoutRateLimiter, requireBuyerPage, addToCart);
router.post("/:id/cart/update", cartCheckoutRateLimiter, requireBuyerPage, updateCartItemQuantity);
router.post("/:id/cart/remove", cartCheckoutRateLimiter, requireBuyerPage, removeCartItem);
router.post("/:id/wishlist", writeRateLimiter, requireBuyerPage, toggleWishlist);
router.post("/:id/buy-now/start", cartCheckoutRateLimiter, requireBuyerPage, startBuyNow);
router.get("/:id/buy-now", requireBuyerPage, getBuyNowPage);
router.post("/:id/buy-now", cartCheckoutRateLimiter, requireBuyerPage, buyNow);
router.get("/:id", publicReadRateLimiter, getProductDetailPage);

export default router;
