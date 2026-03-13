import Joi from "joi";
import { buildMessage, dedupeCaseInsensitive, normalizeListInput, normalizeVariants } from "./helpers.js";

export const reviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().trim().min(2).required(),
  _csrf: Joi.string().optional(),
});

export const reviewReplySchema = Joi.object({
  reply: Joi.string().trim().min(2).required(),
  _csrf: Joi.string().optional(),
});

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
