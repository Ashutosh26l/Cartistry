import Joi from "joi";

const normalizeListInput = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item || "").split(/[\n,]/))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const dedupeCaseInsensitive = (items) => {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

const normalizeVariants = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const sizes = dedupeCaseInsensitive(normalizeListInput(source.sizes));
  const colors = dedupeCaseInsensitive(normalizeListInput(source.colors));
  return { sizes, colors };
};

export const productSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  description: Joi.string().allow("").default(""),
  category: Joi.string().trim().allow("").default(""),
  brand: Joi.string().trim().allow("").default(""),
  dateCreated: Joi.number().required(),
  warranty: Joi.number().min(0).required(),
  price: Joi.number().min(0).required(),
  quantity: Joi.number().min(0).default(0),
  image: Joi.string().allow("").optional(),
  images: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
  galleryImages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
  variants: Joi.object({
    sizes: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
    colors: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
  })
    .optional()
    .default({ sizes: [], colors: [] }),
  variantSizes: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
  variantColors: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow("")).optional(),
  _csrf: Joi.string().optional(),
});

export const reviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().trim().min(2).required(),
  _csrf: Joi.string().optional(),
});

export const reviewReplySchema = Joi.object({
  reply: Joi.string().trim().min(2).required(),
  _csrf: Joi.string().optional(),
});

const buildMessage = (details) => details.map((item) => item.message).join(", ");

export const validateProduct = (req, res, next) => {
  const { error, value } = productSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).render("error", {
      statusCode: 400,
      message: buildMessage(error.details),
    });
  }
  req.body = value;
  return next();
};

export const validateReview = (req, res, next) => {
  const { error, value } = reviewSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).render("error", {
      statusCode: 400,
      message: buildMessage(error.details),
    });
  }
  req.body = value;
  return next();
};

export const validateReviewReply = (req, res, next) => {
  const { error, value } = reviewReplySchema.validate(req.body, {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).render("error", {
      statusCode: 400,
      message: buildMessage(error.details),
    });
  }

  const imagesInput = typeof value.galleryImages !== "undefined" ? value.galleryImages : value.images;
  const normalizedImages = dedupeCaseInsensitive(normalizeListInput(imagesInput));
  const variantsBase = normalizeVariants(value.variants);
  const sizeInput = typeof value.variantSizes !== "undefined" ? value.variantSizes : variantsBase.sizes;
  const colorInput = typeof value.variantColors !== "undefined" ? value.variantColors : variantsBase.colors;

  req.body = value;
  req.body.images = normalizedImages;
  req.body.variants = {
    sizes: dedupeCaseInsensitive(normalizeListInput(sizeInput)),
    colors: dedupeCaseInsensitive(normalizeListInput(colorInput)),
  };

  return next();
};
