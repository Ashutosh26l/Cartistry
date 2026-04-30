import express from "express";
import { requireAuthPage, requireRetailerPage } from "../middleware/auth.js";
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

router.get("/retailer/analytics", getRetailerAnalyticsPage);
router.get("/retailer/bulk/upload", getBulkUploadPage);
router.get("/retailer/bulk/template.csv", downloadBulkCsvTemplate);
router.post("/retailer/bulk/upload/preview", previewBulkUpload);
router.post("/retailer/bulk/upload/commit", commitBulkUpload);
router.get("/retailer/bulk/edit", getBulkEditPage);
router.post("/retailer/bulk/edit/preview", previewBulkEdit);
router.post("/retailer/bulk/edit/apply", applyBulkEditChanges);
router.get("/retailer/notification-preferences", getNotificationPreferencesPage);
router.post("/retailer/notification-preferences", updateNotificationPreferences);

router.get("/api/retailer/analytics/overview", getRetailerAnalyticsOverviewApi);
router.get("/api/retailer/analytics/top-products", getRetailerTopProductsApi);
router.get("/api/retailer/analytics/conversion", getRetailerConversionApi);
router.get("/api/retailer/notification-preferences", getNotificationPreferencesApi);
router.patch("/api/retailer/notification-preferences", patchNotificationPreferencesApi);

export default router;

