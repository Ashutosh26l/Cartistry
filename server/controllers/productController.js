import Product from "../models/productModel.js";
import User from "../models/userModel.js";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseAvailability = (value) => {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "on";
};

const getNormalizedQuantity = (value) => Math.max(0, toNumber(value, 0));
const hasLegacyAvailability = (product) =>
  (typeof product?.quantity === "undefined" || product?.quantity === null) && product?.isAvailable === true;
const hasStock = (product) => getNormalizedQuantity(product?.quantity) > 0 || hasLegacyAvailability(product);
const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 48;
const ALLOWED_SORTS = new Set(["relevance", "newest", "price_asc", "price_desc", "name_asc", "name_desc"]);

const getAvailableQuantityForPurchase = (product) => {
  if (hasLegacyAvailability(product)) return 1;
  return getNormalizedQuantity(product?.quantity);
};

const sanitizeList = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const rawItem of value) {
    const item = String(rawItem || "").trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

const normalizeVariantsPayload = (variants) => {
  const source = variants && typeof variants === "object" ? variants : {};
  return {
    sizes: sanitizeList(source.sizes),
    colors: sanitizeList(source.colors),
  };
};

const getImageFallback = (product) => {
  if (product?.image) return product.image;
  const loweredName = String(product?.name || "").toLowerCase();
  if (loweredName.includes("bicycle")) return "/bicycle.jpg";
  return "/mobile.jpg";
};

const buildGalleryImages = (product) => {
  const gallery = sanitizeList(product?.images);
  const primary = String(product?.image || "").trim();
  if (primary) {
    const alreadyIncluded = gallery.some((image) => image.toLowerCase() === primary.toLowerCase());
    if (!alreadyIncluded) gallery.unshift(primary);
  }
  if (gallery.length === 0) gallery.push(getImageFallback(product));
  return gallery;
};

const getStockMeta = (product) => {
  const quantity = getAvailableQuantityForPurchase(product);
  const isAvailable = hasStock(product);
  if (!isAvailable || quantity <= 0) {
    return {
      isAvailable: false,
      quantity: 0,
      label: "Out of Stock",
      etaLabel: "Currently unavailable",
    };
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return {
      isAvailable: true,
      quantity,
      label: "Low Stock",
      etaLabel: "Delivery in 3-5 business days",
    };
  }
  return {
    isAvailable: true,
    quantity,
    label: "In Stock",
    etaLabel: "Delivery in 2-4 business days",
  };
};

const parsePositiveInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getQueryValue = (value) => {
  if (Array.isArray(value)) {
    const nonEmpty = value.map((item) => String(item || "").trim()).filter(Boolean);
    if (nonEmpty.length > 0) return nonEmpty[nonEmpty.length - 1];
    return "";
  }
  return String(value || "").trim();
};

const normalizeCreatePayload = (body) => {
  const quantity = getNormalizedQuantity(body.quantity);
  return {
    name: body.name,
    description: body.description || "",
    category: String(body.category || "").trim(),
    brand: String(body.brand || "").trim(),
    dateCreated: toNumber(body.dateCreated, Date.now()),
    warranty: toNumber(body.warranty, 0),
    price: toNumber(body.price, 0),
    quantity,
    image: body.image || "",
    images: sanitizeList(body.images),
    variants: normalizeVariantsPayload(body.variants),
    isAvailable: quantity > 0,
  };
};

const normalizeUpdatePayload = (body) => {
  const payload = {};

  if (typeof body.name !== "undefined") payload.name = body.name;
  if (typeof body.description !== "undefined") payload.description = body.description;
  if (typeof body.category !== "undefined") payload.category = String(body.category || "").trim();
  if (typeof body.brand !== "undefined") payload.brand = String(body.brand || "").trim();
  if (typeof body.dateCreated !== "undefined") payload.dateCreated = toNumber(body.dateCreated, Date.now());
  if (typeof body.warranty !== "undefined") payload.warranty = toNumber(body.warranty, 0);
  if (typeof body.price !== "undefined") payload.price = toNumber(body.price, 0);
  if (typeof body.quantity !== "undefined") {
    payload.quantity = getNormalizedQuantity(body.quantity);
    payload.isAvailable = payload.quantity > 0;
  }
  if (typeof body.image !== "undefined") payload.image = body.image;
  if (typeof body.images !== "undefined") payload.images = sanitizeList(body.images);
  if (typeof body.variants !== "undefined") payload.variants = normalizeVariantsPayload(body.variants);

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

const getAvailabilityQuery = (availability) => {
  const parsedAvailability = parseAvailability(availability);
  if (typeof parsedAvailability === "undefined") return null;
  const shouldBeAvailable = parsedAvailability === true;
  const inStockQuery = {
    $or: [
      { quantity: { $gt: 0 } },
      {
        $and: [
          {
            $or: [{ quantity: { $exists: false } }, { quantity: null }],
          },
          { isAvailable: true },
        ],
      },
    ],
  };
  if (shouldBeAvailable) return inStockQuery;
  return { $nor: [inStockQuery] };
};

const getSortDefinition = (sort, hasQuery) => {
  if (sort === "relevance" && hasQuery) return { score: { $meta: "textScore" } };
  if (sort === "price_asc") return { price: 1, createdAt: -1 };
  if (sort === "price_desc") return { price: -1, createdAt: -1 };
  if (sort === "name_asc") return { name: 1, createdAt: -1 };
  if (sort === "name_desc") return { name: -1, createdAt: -1 };
  return { createdAt: -1 };
};

const toProductCardView = (item, wishlistedIds) => {
  const product = item.toObject();
  const stock = getStockMeta(product);
  product.isAvailable = stock.isAvailable;
  product.stockLabel = stock.label;
  product.deliveryEta = stock.etaLabel;
  product.stockQuantity = stock.quantity;
  product.galleryImages = buildGalleryImages(product);
  product.primaryImage = product.galleryImages[0];
  product.isWishlisted = wishlistedIds.has(product._id.toString());
  return product;
};

const calculateShipping = (subtotal) => {
  const amount = Math.max(0, Number(subtotal || 0));
  if (amount >= 499) return 0;
  // Low-value orders pay a small delivery fee near the requested 10-15% band.
  return Math.max(49, Math.round(amount * 0.12));
};

const getCheckoutPricing = (cartItems) => {
  const subtotal = (cartItems || []).reduce(
    (sum, item) => sum + Number(item.product?.price || 0) * Number(item.quantity || 0),
    0
  );
  const shipping = calculateShipping(subtotal);
  const finalTotal = Math.max(0, subtotal + shipping);
  return { subtotal, shipping, finalTotal };
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
    const baseQuery = isRetailerRequest(res) ? { ...getOwnerFilter(req) } : {};
    const q = getQueryValue(req.query.q);
    const category = getQueryValue(req.query.category);
    const brand = getQueryValue(req.query.brand);
    const minPriceRaw = req.query.minPrice;
    const maxPriceRaw = req.query.maxPrice;
    const minPrice = toNumber(minPriceRaw, NaN);
    const maxPrice = toNumber(maxPriceRaw, NaN);
    const availability = getQueryValue(req.query.availability);
    const page = parsePositiveInt(req.query.page, 1, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const sortRaw = String(req.query.sort || "").trim();
    let sort = ALLOWED_SORTS.has(sortRaw) ? sortRaw : q ? "relevance" : "newest";
    if (!q && sort === "relevance") sort = "newest";

    const filters = [];
    if (category) filters.push({ category: new RegExp(`^${escapeRegex(category)}$`, "i") });
    if (brand) filters.push({ brand: new RegExp(`^${escapeRegex(brand)}$`, "i") });

    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      const priceFilter = {};
      if (Number.isFinite(minPrice)) priceFilter.$gte = Math.max(0, minPrice);
      if (Number.isFinite(maxPrice)) priceFilter.$lte = Math.max(0, maxPrice);
      filters.push({ price: priceFilter });
    }

    const availabilityQuery = getAvailabilityQuery(availability);
    if (availabilityQuery) filters.push(availabilityQuery);

    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filters.push({
        $or: [
          { name: pattern },
          { description: pattern },
          { category: pattern },
          { brand: pattern },
        ],
      });
    }

    const query = { ...baseQuery };
    if (filters.length > 0) query.$and = filters;

    const sortDefinition = getSortDefinition(sort, Boolean(q));
    const skip = (page - 1) * limit;
    let [allProductsRaw, totalItems, allCategories, allBrands] = await Promise.all([
      Product.find(query).sort(sortDefinition).skip(skip).limit(limit),
      Product.countDocuments(query),
      Product.distinct("category", baseQuery),
      Product.distinct("brand", baseQuery),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.min(page, totalPages);
    if (currentPage !== page && totalItems > 0) {
      const correctedSkip = (currentPage - 1) * limit;
      allProductsRaw = await Product.find(query).sort(sortDefinition).skip(correctedSkip).limit(limit);
    }
    let wishlistedIds = new Set();
    if (res.locals.currentUser?.role === "buyer") {
      const user = await User.findById(req.user.id).select("wishlist");
      wishlistedIds = new Set((user?.wishlist || []).map((productId) => productId.toString()));
    }
    const allProducts = allProductsRaw.map((item) => toProductCardView(item, wishlistedIds));

    const selectedFilters = {
      q,
      category,
      brand,
      minPrice: Number.isFinite(minPrice) ? String(Math.max(0, minPrice)) : "",
      maxPrice: Number.isFinite(maxPrice) ? String(Math.max(0, maxPrice)) : "",
      availability,
      sort,
      limit,
    };

    return res.render("products", {
      allProducts,
      categories: sanitizeList(allCategories),
      brands: sanitizeList(allBrands),
      selectedFilters,
      pagination: {
        totalItems,
        totalPages,
        page: currentPage,
        limit,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
        prevPage: Math.max(1, currentPage - 1),
        nextPage: Math.min(totalPages, currentPage + 1),
      },
    });
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
      return res.status(404).render("error", { statusCode: 404, message: "Product not found" });
    }
    const productView = product.toObject();
    const stock = getStockMeta(productView);
    productView.isAvailable = stock.isAvailable;
    productView.stockLabel = stock.label;
    productView.deliveryEta = stock.etaLabel;
    productView.stockQuantity = stock.quantity;
    productView.galleryImages = buildGalleryImages(productView);
    productView.primaryImage = productView.galleryImages[0];
    productView.variants = normalizeVariantsPayload(productView.variants);
    productView.isWishlisted = false;
    if (res.locals.currentUser?.role === "buyer") {
      const user = await User.findById(req.user.id).select("wishlist");
      productView.isWishlisted = (user?.wishlist || []).some((productId) => productId.toString() === id);
    }
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
    req.flash("success", "Product updated successfully.");
    return res.redirect(`/products/${product._id}`);
  } catch (error) {
    req.flash("error", "Product could not be edited");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update product" });
  }
};

export const deleteProductPage = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });
    if (!product) {
      req.flash("error", "Product not found");
      return res.status(404).redirect("/products/allProducts");
    }

    await Product.deleteOne({ _id: id, ...getOwnerFilter(req) });
    req.flash("success", "Product deleted successfully.");
    return res.redirect("/products/allProducts");
  } catch (error) {
    req.flash("error", "Unable to delete product");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to delete product" });
  }
};

export const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (res.locals.currentUser?.role !== "buyer") {
      req.flash("error", "Only buyers can add reviews");
      return res.redirect(`/products/${id}`);
    }

    const currentUserName = String(res.locals.currentUser?.name || "").trim();
    const parsedRating = Number(rating);

    if (!currentUserName || !comment || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      req.flash("error", "Please provide a valid review");
      return res.redirect(`/products/${id}`);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id },
      {
        $push: {
          reviews: {
            userName: currentUserName,
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

export const replyToReview = async (req, res) => {
  try {
    const { id, reviewIndex } = req.params;
    const parsedIndex = Number(reviewIndex);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      req.flash("error", "Invalid review selected");
      return res.redirect(`/products/${id}`);
    }

    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });
    if (!product) {
      req.flash("error", "Retailer access only");
      return res.status(403).redirect("/products/allProducts");
    }

    if (!Array.isArray(product.reviews) || parsedIndex >= product.reviews.length) {
      req.flash("error", "Review not found");
      return res.redirect(`/products/${id}`);
    }

    const replyText = String(req.body.reply || "").trim();
    if (!replyText) {
      req.flash("error", "Reply cannot be empty");
      return res.redirect(`/products/${id}`);
    }

    product.reviews[parsedIndex].retailerReply = replyText;
    product.reviews[parsedIndex].repliedBy = String(res.locals.currentUser?.name || "Retailer").trim();
    product.reviews[parsedIndex].repliedAt = new Date();
    await product.save();

    req.flash("success", "Reply posted successfully.");
    return res.redirect(`/products/${id}`);
  } catch (error) {
    req.flash("error", "Unable to post reply");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to post reply" });
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
    req.flash("success", "Removed from cart.");
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
