import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import {
  ALLOWED_SORTS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildGalleryImages,
  escapeRegex,
  getAvailabilityQuery,
  getOwnerFilter,
  getQueryValue,
  getSortDefinition,
  getStockMeta,
  isRetailerRequest,
  normalizeCreatePayload,
  normalizeUpdatePayload,
  normalizeVariantsPayload,
  parsePositiveInt,
  sanitizeList,
  toNumber,
  toProductCardView,
} from "./productShared.js";

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
        $or: [{ name: pattern }, { description: pattern }, { category: pattern }, { brand: pattern }],
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
