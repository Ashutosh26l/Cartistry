import Product from "../../models/productModel.js";
import { getOwnerFilter, normalizeCreatePayload, normalizeUpdatePayload } from "./productShared.js";

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find(getOwnerFilter(req)).sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const payload = normalizeCreatePayload(req.body);
    const product = await Product.create({
      ...payload,
      owner: req.user.id,
    });

    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create product" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: not your product" });
    }

    Object.assign(product, normalizeUpdatePayload(req.body));
    await product.save();

    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update product" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    await Product.findOneAndDelete({ _id: id, ...getOwnerFilter(req) });
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete product" });
  }
};
