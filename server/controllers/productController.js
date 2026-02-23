import Product from "../models/productModel.js";
import User from "../models/userModel.js";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseAvailability = (value) => {
  if (typeof value === "undefined") return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "on";
};

const getNormalizedQuantity = (value) => Math.max(0, toNumber(value, 0));
const hasLegacyAvailability = (product) =>
  (typeof product?.quantity === "undefined" || product?.quantity === null) && product?.isAvailable === true;
const hasStock = (product) => getNormalizedQuantity(product?.quantity) > 0 || hasLegacyAvailability(product);
const getAvailableQuantityForPurchase = (product) => {
  if (hasLegacyAvailability(product)) return 1;
  return getNormalizedQuantity(product?.quantity);
};

const normalizeCreatePayload = (body) => {
  const quantity = getNormalizedQuantity(body.quantity);
  return {
    name: body.name,
    description: body.description || "",
    dateCreated: toNumber(body.dateCreated, Date.now()),
    warranty: toNumber(body.warranty, 0),
    price: toNumber(body.price, 0),
    quantity,
    image: body.image || "",
    isAvailable: quantity > 0,
  };
};

const normalizeUpdatePayload = (body) => {
  const payload = {};

  if (typeof body.name !== "undefined") payload.name = body.name;
  if (typeof body.description !== "undefined") payload.description = body.description;
  if (typeof body.dateCreated !== "undefined") payload.dateCreated = toNumber(body.dateCreated, Date.now());
  if (typeof body.warranty !== "undefined") payload.warranty = toNumber(body.warranty, 0);
  if (typeof body.price !== "undefined") payload.price = toNumber(body.price, 0);
  if (typeof body.quantity !== "undefined") {
    payload.quantity = getNormalizedQuantity(body.quantity);
    payload.isAvailable = payload.quantity > 0;
  }
  if (typeof body.image !== "undefined") payload.image = body.image;

  const isAvailable = parseAvailability(body.isAvailable);
  if (typeof isAvailable !== "undefined" && typeof payload.quantity === "undefined") {
    payload.isAvailable = isAvailable;
    payload.quantity = isAvailable ? 1 : 0;
  }

  return payload;
};

const getOwnerFilter = (req) => ({ owner: req.user.id });
const isRetailerRequest = (res) => {
  const role = res.locals.currentUser?.role;
  return role === "retailer" || role === "admin";
};
const getSafeRedirectPath = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/products/")) return fallback;
  return value;
};

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

export const getAllProductsPage = async (req, res) => {
  try {
    const { availability, q } = req.query;
    const query = isRetailerRequest(res) ? { ...getOwnerFilter(req) } : {};

    if (typeof availability !== "undefined") {
      query.isAvailable = availability === "true";
    }
    if (q) {
      query.name = { $regex: String(q), $options: "i" };
    }

    const allProductsRaw = await Product.find(query).sort({ createdAt: -1 });
    let wishlistedIds = new Set();
    if (res.locals.currentUser?.role === "buyer") {
      const user = await User.findById(req.user.id).select("wishlist");
      wishlistedIds = new Set((user?.wishlist || []).map((productId) => productId.toString()));
    }
    const allProducts = allProductsRaw.map((item) => {
      const product = item.toObject();
      product.isAvailable = hasStock(product);
      product.isWishlisted = wishlistedIds.has(product._id.toString());
      return product;
    });
    return res.render("products", { allProducts });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load products" });
  }
};

export const getProductDetailPage = async (req, res) => {
  try {
    const { id } = req.params;
    const product = isRetailerRequest(res)
      ? await Product.findOne({ _id: id, ...getOwnerFilter(req) })
      : await Product.findById(id);

    if (!product) {
      return res.status(404).render("product_detail", { product: null });
    }
    const productView = product.toObject();
    productView.isAvailable = hasStock(productView);
    return res.render("product_detail", { product: productView });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load product details" });
  }
};

export const getEditProductPage = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });

    if (!product) {
      return res.status(404).render("edit", { product: null });
    }

    return res.render("edit", { product });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load edit page" });
  }
};

export const updateProductPage = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });

    if (!product) {
      return res.status(403).send("Forbidden");
    }

    Object.assign(product, normalizeUpdatePayload(req.body));
    await product.save();
    req.flash("success", "Product edited successfully");
    return res.redirect(`/products/${product._id}`);
  } catch (error) {
    req.flash("error", "Product could not be edited");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update product" });
  }
};

export const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, rating, comment } = req.body;
    const parsedRating = Number(rating);

    if (!userName || !comment || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      req.flash("error", "Please provide a valid review");
      return res.redirect(`/products/${id}`);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id },
      {
        $push: {
          reviews: {
            userName: String(userName).trim(),
            rating: parsedRating,
            comment: String(comment).trim(),
          },
        },
      },
      { new: true }
    );

    if (!updatedProduct) return res.status(403).send("Forbidden");
    req.flash("success", "Review added successfully");
    return res.redirect(`/products/${id}`);
  } catch (error) {
    req.flash("error", "Unable to add review");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to add review" });
  }
};

export const getAddProductPage = (req, res) => {
  return res.render("add_product");
};

export const createProductPage = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      req.flash("error", "Product name is required");
      return res.status(400).send("Product name is required");
    }

    const payload = normalizeCreatePayload(req.body);
    await Product.create({
      ...payload,
      owner: req.user.id,
    });
    req.flash("success", "Product added successfully");
    return res.redirect("/products/allProducts");
  } catch (error) {
    req.flash("error", "Product could not be added");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to add product" });
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
    const total = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 0),
      0
    );

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
    return res.redirect(redirectPath);
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to remove cart item" });
  }
};

export const toggleWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const redirectPath = getSafeRedirectPath(req.body.redirectTo, "/products/allProducts");
    const product = await Product.findById(id).select("_id");
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect(redirectPath);
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).redirect("/auth/login");

    const existingIndex = (user.wishlist || []).findIndex((productId) => productId.toString() === id);
    if (existingIndex >= 0) {
      user.wishlist.splice(existingIndex, 1);
      req.flash("success", "Removed from wishlist");
    } else {
      user.wishlist.push(product._id);
      req.flash("success", "Added to wishlist");
    }

    await user.save();
    return res.redirect(redirectPath);
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update wishlist" });
  }
};

export const getWishlistPage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("wishlist");
    if (!user) return res.status(401).redirect("/auth/login");

    const wishlistItems = (user.wishlist || []).filter(Boolean).map((item) => {
      const product = item.toObject();
      product.isAvailable = hasStock(product);
      product.isWishlisted = true;
      return product;
    });

    return res.render("wishlist", { wishlistItems });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load wishlist" });
  }
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

    const existingIndex = user.cart.findIndex((item) => item.product.toString() === id);
    if (existingIndex >= 0) {
      user.cart[existingIndex].quantity += 1;
    } else {
      user.cart.push({ product: product._id, quantity: 1 });
    }
    await user.save();

    const hydratedUser = await User.findById(req.user.id).populate("cart.product");
    const cartItems = (hydratedUser?.cart || []).filter((item) => item.product);
    const total = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 0),
      0
    );

    return res.render("buy_now", { product, cartItems, total, formData: {} });
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
    const total = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 0),
      0
    );

    if (cartItems.length === 0) {
      return res.status(400).render("buy_now", {
        product,
        cartItems,
        total,
        formData: req.body,
        error: "Your cart is empty. Add products before checkout.",
      });
    }

    if (!fullName || !email || !phone || !addressLine1 || !city || !state || !pincode || !paymentMethod) {
      return res.status(400).render("buy_now", {
        product,
        cartItems,
        total,
        formData: req.body,
        error: "Please fill all required checkout details",
      });
    }

    for (const item of cartItems) {
      const stockProduct = await Product.findById(item.product._id);
      if (!stockProduct) {
        return res.status(400).render("buy_now", {
          product,
          cartItems,
          total,
          formData: req.body,
          error: "One of the items in your cart no longer exists.",
        });
      }

      const requestedQuantity = Math.max(1, Number(item.quantity || 1));
      const availableQuantity = getAvailableQuantityForPurchase(stockProduct);
      if (availableQuantity < requestedQuantity || availableQuantity <= 0) {
        return res.status(400).render("buy_now", {
          product,
          cartItems,
          total,
          formData: req.body,
          error: `Only ${Math.max(availableQuantity, 0)} item(s) available for ${stockProduct.name}.`,
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
