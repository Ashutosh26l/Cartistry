import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import RetailerEvent from "../../models/retailerEventModel.js";
import { getRetailerPreference, shouldSendNotification } from "../../models/retailerPreferenceModel.js";
import { getAvailableQuantityForPurchase, getCheckoutPricing, hasStock } from "./productShared.js";

const recordRetailerEvent = async (payload) => {
  try {
    await RetailerEvent.create(payload);
  } catch (error) {
    // Analytics events should not block checkout.
  }
};

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

const maybeSendLowStockAlert = async ({ retailerId, product, quantity }) => {
  if (!retailerId || !product) return;
  const [preference, retailer] = await Promise.all([
    getRetailerPreference(retailerId),
    User.findById(retailerId).select("email name"),
  ]);
  if (!retailer?.email) return;

  const threshold = Number(preference?.lowStockThreshold || 5);
  if (quantity > threshold) return;
  const allowEmail = shouldSendNotification(preference, {
    eventKey: "low_stock",
    channel: "email",
    critical: true,
  });
  if (!allowEmail) return;

  await sendEmailIfConfigured({
    to: retailer.email,
    subject: `Low stock alert: ${product.name}`,
    text: `Product "${product.name}" is low on stock. Remaining quantity: ${quantity}.`,
  });
};

export const getBuyNowPage = async (req, res) => {
  try {
    const { id } = req.params;
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

export const startBuyNow = async (req, res) => {
  try {
    const { id } = req.params;
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
      eventType: "buy_now_start",
      sessionId: String(req.sessionID || ""),
      occurredAt: new Date(),
    });
    return res.redirect(`/products/${id}/buy-now`);
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to start checkout" });
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

    const ordersByRetailer = new Map();
    for (const item of cartItems) {
      const productId = String(item.product?._id || "");
      const retailerId = String(item.product?.owner || "");
      if (!productId || !retailerId) continue;
      const requestedQuantity = Math.max(1, Number(item.quantity || 1));
      const unitPrice = Math.max(0, Number(item.product?.price || 0));
      const lineTotal = unitPrice * requestedQuantity;
      if (!ordersByRetailer.has(retailerId)) {
        ordersByRetailer.set(retailerId, {
          retailerId,
          items: [],
          subtotal: 0,
        });
      }
      const draft = ordersByRetailer.get(retailerId);
      draft.items.push({
        product: item.product._id,
        nameSnapshot: item.product.name || "Product",
        unitPrice,
        quantity: requestedQuantity,
        lineTotal,
      });
      draft.subtotal += lineTotal;
    }

    for (const item of cartItems) {
      const stockProduct = await Product.findById(item.product._id);
      const requestedQuantity = Math.max(1, Number(item.quantity || 1));
      const availableQuantity = getAvailableQuantityForPurchase(stockProduct);
      stockProduct.quantity = Math.max(0, availableQuantity - requestedQuantity);
      stockProduct.isAvailable = stockProduct.quantity > 0;
      await stockProduct.save();
      await maybeSendLowStockAlert({
        retailerId: stockProduct.owner,
        product: stockProduct,
        quantity: stockProduct.quantity,
      });
    }

    const orderDocs = [];
    for (const [, draft] of ordersByRetailer.entries()) {
      const shippingFee = draft.subtotal >= 499 ? 0 : Math.max(49, Math.round(draft.subtotal * 0.12));
      const orderDoc = {
        buyer: req.user.id,
        retailer: draft.retailerId,
        items: draft.items,
        subtotal: draft.subtotal,
        shippingFee,
        discount: 0,
        grandTotal: Math.max(0, draft.subtotal + shippingFee),
        status: "placed",
        placedAt: new Date(),
        paymentMethod: String(paymentMethod || "").trim(),
        shippingAddressSnapshot: {
          fullName,
          email,
          phone,
          addressLine1,
          city,
          state,
          pincode,
        },
      };
      orderDocs.push(orderDoc);
    }

    if (orderDocs.length > 0) {
      await Order.insertMany(orderDocs);
      await Promise.all(
        orderDocs.map((doc) =>
          recordRetailerEvent({
            retailer: doc.retailer,
            buyer: doc.buyer,
            product: doc.items[0]?.product || null,
            eventType: "purchase_success",
            sessionId: String(req.sessionID || ""),
            occurredAt: new Date(),
            metadata: {
              orderTotal: doc.grandTotal,
              itemCount: doc.items.length,
            },
          })
        )
      );
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

