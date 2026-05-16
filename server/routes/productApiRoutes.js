import express from "express";
import authMiddleware, { requireRetailerApi } from "../middleware/auth.js";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import { handleProductImageUpload } from "../middleware/upload.js";
import { publicReadRateLimiter, writeRateLimiter } from "../middleware/rateLimit.js";
import { validateProduct } from "../middleware/validation.js";

const router = express.Router();

router.use(authMiddleware, requireRetailerApi);
router.get("/", publicReadRateLimiter, getProducts);
router.post("/", writeRateLimiter, handleProductImageUpload, validateProduct, createProduct);
router.put("/:id", writeRateLimiter, handleProductImageUpload, validateProduct, updateProduct);
router.patch("/:id", writeRateLimiter, handleProductImageUpload, validateProduct, updateProduct);
router.delete("/:id", writeRateLimiter, deleteProduct);

export default router;
