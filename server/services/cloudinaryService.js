import { v2 as cloudinary } from "cloudinary";

const DEFAULT_PRODUCT_FOLDER = "cartistry/products";
let hasConfiguredCloudinary = false;

const getCloudinaryCredentials = () => {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
};

const isCloudinaryConfigured = () => Boolean(getCloudinaryCredentials());

const ensureCloudinaryConfigured = () => {
  if (hasConfiguredCloudinary) return true;
  const credentials = getCloudinaryCredentials();
  if (!credentials) return false;
  cloudinary.config(credentials);
  hasConfiguredCloudinary = true;
  return true;
};

const uploadImageBufferToCloudinary = async ({ buffer, mimetype, ownerId = "", productName = "", variant = "image" }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Uploaded image file is empty.");
  }

  if (!ensureCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }

  const safeOwner = String(ownerId || "retailer").replace(/[^a-zA-Z0-9_-]/g, "");
  const safeName = String(productName || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "product";
  const safeVariant = String(variant || "image")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24) || "image";
  const publicId = `${safeOwner}-${safeName}-${Date.now()}-${safeVariant}`;
  const folder = String(process.env.CLOUDINARY_PRODUCT_FOLDER || DEFAULT_PRODUCT_FOLDER).trim() || DEFAULT_PRODUCT_FOLDER;

  const encoded = buffer.toString("base64");
  const dataUri = `data:${mimetype};base64,${encoded}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    resource_type: "image",
    folder,
    public_id: publicId,
    overwrite: true,
  });

  return {
    secureUrl: String(result.secure_url || ""),
    publicId: String(result.public_id || ""),
  };
};

export { isCloudinaryConfigured, uploadImageBufferToCloudinary };
