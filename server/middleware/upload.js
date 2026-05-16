import multer from "multer";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const maxImageBytes = Number(process.env.PRODUCT_IMAGE_MAX_BYTES) || DEFAULT_MAX_IMAGE_BYTES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(1, maxImageBytes),
    files: 7,
  },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return callback(null, true);
    }
    return callback(new Error("Only PNG, JPEG/JPG and WEBP images are allowed."));
  },
});

const productImageUpload = upload.fields([
  { name: "imageFile", maxCount: 1 },
  { name: "galleryFiles", maxCount: 6 },
]);

const getUploadErrorMessage = (error) => {
  if (!error) return "";
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      const sizeMb = (Math.max(1, maxImageBytes) / (1024 * 1024)).toFixed(1);
      return `Each image must be ${sizeMb}MB or smaller.`;
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return "Too many files uploaded. Max 1 primary + 6 gallery images.";
    }
    return "Image upload failed. Please upload valid files.";
  }
  return String(error.message || "Image upload failed.");
};

const wantsHtml = (req) => req.headers.accept && req.headers.accept.includes("text/html");

export const handleProductImageUpload = (req, res, next) => {
  productImageUpload(req, res, (error) => {
    if (!error) return next();
    const message = getUploadErrorMessage(error);
    if (wantsHtml(req)) {
      return res.status(400).render("error", { statusCode: 400, message });
    }
    return res.status(400).json({ message });
  });
};
