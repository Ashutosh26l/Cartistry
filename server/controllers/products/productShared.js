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
  // The products page currently uses regex-based query matching, not $text search.
  // Sorting by textScore without a $text predicate causes runtime 500 errors.
  if (sort === "relevance" && hasQuery) return { createdAt: -1 };
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

export {
  ALLOWED_SORTS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildGalleryImages,
  escapeRegex,
  getAvailabilityQuery,
  getAvailableQuantityForPurchase,
  getCheckoutPricing,
  getOwnerFilter,
  getQueryValue,
  getSafeRedirectPath,
  getSortDefinition,
  getStockMeta,
  hasStock,
  isRetailerRequest,
  normalizeCreatePayload,
  normalizeUpdatePayload,
  normalizeVariantsPayload,
  parsePositiveInt,
  sanitizeList,
  toNumber,
  toProductCardView,
};
