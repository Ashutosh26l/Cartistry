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
  getWishlistPage,
  getEditProductPage,
  getRetailerNotificationsPage,
  getProductDetailPage,
  markRetailerNotificationRead,
  removeCartItem,
  replyToReview,
  toggleWishlist,
  updateCartItemQuantity,
  updateProductPage,
} from "../controllers/productController.js";
import { requireAuthPage, requireBuyerPage, requireRetailerPage } from "../middleware/auth.js";
import { validateProduct, validateReview, validateReviewReply } from "../middleware/validation.js";

const router = express.Router();

router.use(requireAuthPage);

router.get("/allProducts", getAllProductsPage);
router.get("/notifications", requireRetailerPage, getRetailerNotificationsPage);
router.post("/notifications/:notificationId/read", requireRetailerPage, markRetailerNotificationRead);
router.post("/:id/reviews", requireBuyerPage, validateReview, addProductReview);
router.post("/:id/reviews/:reviewIndex/reply", requireRetailerPage, validateReviewReply, replyToReview);
router.get("/new", requireRetailerPage, getAddProductPage);
router.post("/new", requireRetailerPage, validateProduct, createProductPage);
router.get("/edit/:id", requireRetailerPage, getEditProductPage);
router.post("/edit/:id", requireRetailerPage, validateProduct, updateProductPage);
router.post("/:id/delete", requireRetailerPage, deleteProductPage);
router.get("/cart", requireBuyerPage, getCartPage);
router.get("/wishlist", requireBuyerPage, getWishlistPage);
router.post("/:id/cart", requireBuyerPage, addToCart);
router.post("/:id/cart/update", requireBuyerPage, updateCartItemQuantity);
router.post("/:id/cart/remove", requireBuyerPage, removeCartItem);
router.post("/:id/wishlist", requireBuyerPage, toggleWishlist);
router.get("/:id/buy-now", requireBuyerPage, getBuyNowPage);
router.post("/:id/buy-now", requireBuyerPage, buyNow);
router.get("/:id", getProductDetailPage);

export default router;
