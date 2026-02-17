import express from "express";
import {
  addToCart,
  addProductReview,
  buyNow,
  createProductPage,
  getCartPage,
  getBuyNowPage,
  getAddProductPage,
  getAllProductsPage,
  getEditProductPage,
  getProductDetailPage,
  removeCartItem,
  updateCartItemQuantity,
  updateProductPage,
} from "../controllers/productController.js";
import { requireAuthPage } from "../middleware/auth.js";
import { validateProduct, validateReview } from "../middleware/validation.js";

const router = express.Router();

router.use(requireAuthPage);

router.get("/new", getAddProductPage);
router.post("/new", validateProduct, createProductPage);
router.get("/allProducts", getAllProductsPage);
router.get("/edit/:id", getEditProductPage);
router.post("/edit/:id", validateProduct, updateProductPage);
router.post("/:id/reviews", validateReview, addProductReview);
router.get("/cart", getCartPage);
router.post("/:id/cart", addToCart);
router.post("/:id/cart/update", updateCartItemQuantity);
router.post("/:id/cart/remove", removeCartItem);
router.get("/:id/buy-now", getBuyNowPage);
router.post("/:id/buy-now", buyNow);
router.get("/:id", getProductDetailPage);

export default router;
