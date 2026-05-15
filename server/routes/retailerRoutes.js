import express from "express";
import { requireAuthPage, requireRetailerPage } from "../middleware/auth.js";
import { bulkOperationRateLimiter, publicReadRateLimiter, writeRateLimiter } from "../middleware/rateLimit.js";
import {
  applyBulkEditChanges,
  commitBulkUpload,
  downloadBulkCsvTemplate,
  ensureRetailerPreferencesRecord,
  getBulkEditPage,
  getBulkUploadPage,
  getNotificationPreferencesApi,
  getNotificationPreferencesPage,
  getRetailerAnalyticsOverviewApi,
  getRetailerAnalyticsPage,
  getRetailerConversionApi,
  getRetailerTopProductsApi,
  patchNotificationPreferencesApi,
  previewBulkEdit,
  previewBulkUpload,
  updateNotificationPreferences,
} from "../controllers/retailer/retailerOperationsController.js";

const router = express.Router();

router.use("/retailer", requireAuthPage, requireRetailerPage, ensureRetailerPreferencesRecord);
router.use("/api/retailer", requireAuthPage, requireRetailerPage, ensureRetailerPreferencesRecord);

router.get("/retailer/analytics", publicReadRateLimiter, getRetailerAnalyticsPage);
router.get("/retailer/bulk/upload", publicReadRateLimiter, getBulkUploadPage);
router.get("/retailer/bulk/template.csv", publicReadRateLimiter, downloadBulkCsvTemplate);
router.post("/retailer/bulk/upload/preview", bulkOperationRateLimiter, previewBulkUpload);
router.post("/retailer/bulk/upload/commit", bulkOperationRateLimiter, commitBulkUpload);
router.get("/retailer/bulk/edit", publicReadRateLimiter, getBulkEditPage);
router.post("/retailer/bulk/edit/preview", bulkOperationRateLimiter, previewBulkEdit);
router.post("/retailer/bulk/edit/apply", bulkOperationRateLimiter, applyBulkEditChanges);
router.get("/retailer/notification-preferences", publicReadRateLimiter, getNotificationPreferencesPage);
router.post("/retailer/notification-preferences", writeRateLimiter, updateNotificationPreferences);

router.get("/api/retailer/analytics/overview", publicReadRateLimiter, getRetailerAnalyticsOverviewApi);
router.get("/api/retailer/analytics/top-products", publicReadRateLimiter, getRetailerTopProductsApi);
router.get("/api/retailer/analytics/conversion", publicReadRateLimiter, getRetailerConversionApi);
router.get("/api/retailer/notification-preferences", publicReadRateLimiter, getNotificationPreferencesApi);
router.patch("/api/retailer/notification-preferences", writeRateLimiter, patchNotificationPreferencesApi);

export default router;
