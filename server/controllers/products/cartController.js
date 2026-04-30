import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import RetailerEvent from "../../models/retailerEventModel.js";
import { getSafeRedirectPath, hasStock } from "./productShared.js";

const recordRetailerEvent = async (payload) => {
  try {
    await RetailerEvent.create(payload);
  } catch (error) {
    // Do not block buyer flow for analytics event failures.
  }
};

export const addToCart = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product || !hasStock(product)) {
      req.flash("error", "This product is currently out of stock");
      return res.status(400).redirect(`/products/${id}`);
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).redirect("/auth/login");

    const existingIndex = user.cart.findIndex((item) => item.product.toString() === id);
    if (existingIndex >= 0) {
      user.cart[existingIndex].quantity += 1;
    } else {
      user.cart.push({ product: product._id, quantity: 1 });
    }

    await user.save();
    await recordRetailerEvent({
      retailer: product.owner,
      buyer: req.user.id,
      product: product._id,
      eventType: "add_to_cart",
      sessionId: String(req.sessionID || ""),
      occurredAt: new Date(),
    });
    req.flash("success", "Added to cart.");
    return res.redirect("/products/cart");
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to add product to cart" });
  }
};

export const getCartPage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("cart.product");
    if (!user) return res.status(401).redirect("/auth/login");

    const cartItems = (user.cart || []).filter((item) => item.product);
    const total = cartItems.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 0), 0);

    return res.render("cart", { cartItems, total });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load cart" });
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const redirectPath = getSafeRedirectPath(req.body.redirectTo, "/products/cart");
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).redirect("/auth/login");

    const cartItem = user.cart.find((item) => item.product.toString() === id);
    if (!cartItem) return res.redirect(redirectPath);

    if (action === "increase") {
      cartItem.quantity += 1;
    } else {
      cartItem.quantity = Math.max(1, Number(cartItem.quantity || 1) - 1);
    }

    await user.save();
    return res.redirect(redirectPath);
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update cart item" });
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const redirectPath = getSafeRedirectPath(req.body.redirectTo, "/products/cart");
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).redirect("/auth/login");

    user.cart = (user.cart || []).filter((item) => item.product.toString() !== id);
    await user.save();
    req.flash("success", "Removed from cart.");
    return res.redirect(redirectPath);
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to remove cart item" });
  }
};
