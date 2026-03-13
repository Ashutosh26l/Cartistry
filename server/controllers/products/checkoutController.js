import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import { getAvailableQuantityForPurchase, getCheckoutPricing, hasStock } from "./productShared.js";

export const getBuyNowPage = async (req, res) => {
  try {
    const { id } = req.params;
    const shouldAddItem = req.query.add === "1";
    const product = await Product.findById(id);

    if (!product) {
      req.flash("error", "Product not found");
      return res.status(404).redirect("/products/allProducts");
    }

    if (!hasStock(product)) {
      req.flash("error", "This product is out of stock");
      return res.status(400).redirect(`/products/${id}`);
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).redirect("/auth/login");

    // Only add once when explicitly requested from product page.
    // Redirect to clean URL so refresh does not add again.
    if (shouldAddItem) {
      const existingIndex = user.cart.findIndex((item) => item.product.toString() === id);
      if (existingIndex >= 0) {
        user.cart[existingIndex].quantity += 1;
      } else {
        user.cart.push({ product: product._id, quantity: 1 });
      }
      await user.save();
      return res.redirect(`/products/${id}/buy-now`);
    }

    const hydratedUser = await User.findById(req.user.id).populate("cart.product");
    const cartItems = (hydratedUser?.cart || []).filter((item) => item.product);
    const pricing = getCheckoutPricing(cartItems);
    return res.render("buy_now", {
      product,
      cartItems,
      formData: {},
      ...pricing,
    });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load checkout page" });
  }
};

export const buyNow = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    const { fullName, email, phone, addressLine1, city, state, pincode, paymentMethod } = req.body;
    const user = await User.findById(req.user.id).populate("cart.product");
    if (!user) return res.status(401).redirect("/auth/login");
    const cartItems = (user.cart || []).filter((item) => item.product);
    const pricing = getCheckoutPricing(cartItems);

    if (cartItems.length === 0) {
      return res.status(400).render("buy_now", {
        product,
        cartItems,
        formData: req.body,
        error: "Your cart is empty. Add products before checkout.",
        ...pricing,
      });
    }

    if (!fullName || !email || !phone || !addressLine1 || !city || !state || !pincode || !paymentMethod) {
      return res.status(400).render("buy_now", {
        product,
        cartItems,
        formData: req.body,
        error: "Please fill all required checkout details",
        ...pricing,
      });
    }

    for (const item of cartItems) {
      const stockProduct = await Product.findById(item.product._id);
      if (!stockProduct) {
        return res.status(400).render("buy_now", {
          product,
          cartItems,
          formData: req.body,
          error: "One of the items in your cart no longer exists.",
          ...pricing,
        });
      }

      const requestedQuantity = Math.max(1, Number(item.quantity || 1));
      const availableQuantity = getAvailableQuantityForPurchase(stockProduct);
      if (availableQuantity < requestedQuantity || availableQuantity <= 0) {
        return res.status(400).render("buy_now", {
          product,
          cartItems,
          formData: req.body,
          error: `Only ${Math.max(availableQuantity, 0)} item(s) available for ${stockProduct.name}.`,
          ...pricing,
        });
      }
    }

    for (const item of cartItems) {
      const stockProduct = await Product.findById(item.product._id);
      const requestedQuantity = Math.max(1, Number(item.quantity || 1));
      const availableQuantity = getAvailableQuantityForPurchase(stockProduct);
      stockProduct.quantity = Math.max(0, availableQuantity - requestedQuantity);
      stockProduct.isAvailable = stockProduct.quantity > 0;
      await stockProduct.save();
    }

    user.cart = [];
    await user.save();

    return res.render("order_success", {
      message: "Order placed successfully",
      product,
      quantity: cartItems.length,
      remainingQuantity: 0,
    });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to place order" });
  }
};
