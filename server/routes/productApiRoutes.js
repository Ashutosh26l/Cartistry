import express from "express";
import authMiddleware, { requireRetailerApi } from "../middleware/auth.js";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import { validateProduct } from "../middleware/validation.js";

const router = express.Router();

router.use(authMiddleware, requireRetailerApi);
router.get("/", getProducts);
router.post("/", validateProduct, createProduct);
router.put("/:id", validateProduct, updateProduct);
router.patch("/:id", validateProduct, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
