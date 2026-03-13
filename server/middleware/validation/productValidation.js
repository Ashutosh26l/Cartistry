import Joi from "joi";
import { buildMessage } from "./helpers.js";

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
