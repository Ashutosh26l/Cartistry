# Retailer Operations Phase - Implementation Plan

Build the next operations layer for this ecommerce app with:
- **Retailer dashboard analytics** (sales, top products, conversion, pending replies)
- **Bulk product upload (CSV) + bulk edit**
- **Notification preferences** (in-app + email for critical events)

This plan is aligned with the current stack: **Node.js + Express 5 + MongoDB + EJS + Socket.IO**.

## Assumptions (based on current codebase)

Since some business rules are not finalized yet, this plan uses safe defaults:
- **Retailer analytics scope**: per-retailer only (`owner = current retailer`)
- **Sales source of truth**: create an `Order` record during checkout success
- **Conversion definition (default)**: `purchases / product-detail-views` in selected date range
- **Critical notification types** (default): new low-stock alert, new review pending reply, failed CSV import row summary
- **Email provider (phase-1 default)**: SMTP via `nodemailer`
- **CSV upload limits**: max 2,000 rows per upload, max 2 MB file

> [!IMPORTANT]
> **Prerequisites before implementation**:
> 1. SMTP credentials for email alerts (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
> 2. Final confirmation on conversion formula and low-stock threshold defaults

---

## Existing Baseline (already present)

- Retailer dashboard exists at `/` for retailer role with product stats + pending notifications
- Product CRUD exists for retailer (`/products/new`, `/products/edit/:id`, `/api/products/*`)
- Review notifications + reply workflow already exists (`notificationHistory`)
- Realtime updates already wired with Socket.IO rooms
- No `Order` model yet (checkout currently reduces stock and clears cart only)
- No CSV import pipeline yet
- No notification preference model yet

---

## Project Structure (Proposed Additions)

```text
server/
|-- controllers/
|   |-- retailer/
|   |   |-- retailerAnalyticsController.js         [NEW]
|   |   |-- retailerBulkController.js              [NEW]
|   |   `-- retailerNotificationPrefController.js  [NEW]
|-- services/
|   |-- analytics/
|   |   |-- retailerAnalyticsService.js            [NEW]
|   |   `-- conversionService.js                   [NEW]
|   |-- bulk/
|   |   |-- csvImportService.js                    [NEW]
|   |   |-- bulkEditService.js                     [NEW]
|   |   `-- csvTemplateService.js                  [NEW]
|   `-- notifications/
|       |-- emailService.js                        [NEW]
|       `-- preferenceResolver.js                  [NEW]
|-- models/
|   |-- orderModel.js                              [NEW]
|   |-- retailerEventModel.js                      [NEW]
|   `-- retailerPreferenceModel.js                 [NEW] (or extend userModel)
|-- routes/
|   |-- retailerRoutes.js                          [NEW]
|   `-- productApiRoutes.js                        [UPDATE for bulk endpoints]
|-- middleware/
|   |-- validation/
|   |   |-- retailerAnalyticsValidation.js         [NEW]
|   |   `-- retailerBulkValidation.js              [NEW]
|   `-- upload/
|       `-- csvUploadMiddleware.js                 [NEW]
|-- views/
|   |-- retailer_analytics.ejs                     [NEW]
|   |-- retailer_bulk_upload.ejs                   [NEW]
|   |-- retailer_bulk_edit.ejs                     [NEW]
|   `-- retailer_notification_preferences.ejs      [NEW]
|-- public/
|   `-- js/
|       |-- retailer-analytics.js                  [NEW]
|       |-- retailer-bulk.js                       [NEW]
|       `-- retailer-notification-prefs.js         [NEW]
|-- scripts/
|   |-- backfillOrdersFromInventoryDelta.js        [NEW optional one-time helper]
|   `-- seedRetailerEvents.js                      [NEW optional local testing]
`-- app.js                                         [UPDATE]
```

---

## Data Model Changes

### [NEW] `server/models/orderModel.js`
Purpose: sales analytics ke liye durable source-of-truth.

Core fields:
- `buyer` (ObjectId -> User)
- `retailer` (ObjectId -> User, indexed)
- `items[]`: `product`, `nameSnapshot`, `unitPrice`, `quantity`, `lineTotal`
- `subtotal`, `shippingFee`, `discount`, `grandTotal`
- `status` (`placed`, `cancelled`, `refunded`)
- `placedAt`, `paymentMethod`
- `shippingAddressSnapshot`

Indexes:
- `{ retailer: 1, placedAt: -1 }`
- `{ retailer: 1, status: 1, placedAt: -1 }`
- `{ "items.product": 1, placedAt: -1 }`

### [NEW] `server/models/retailerEventModel.js`
Purpose: conversion and funnel analytics.

Event types:
- `product_view`
- `add_to_cart`
- `buy_now_start`
- `purchase_success`

Fields:
- `retailer`, `buyer`, `product`, `eventType`, `sessionId`, `occurredAt`

Indexes:
- `{ retailer: 1, eventType: 1, occurredAt: -1 }`
- `{ retailer: 1, product: 1, occurredAt: -1 }`

### [NEW] `server/models/retailerPreferenceModel.js` (or extend `userModel.js`)
Purpose: per-retailer notification controls.

Fields:
- `retailer` (unique ref)
- `channels`: `{ inApp: boolean, email: boolean }`
- `criticalOnly`: `boolean`
- `eventToggles`: `{ lowStock, newReview, csvImportSummary, securityAlert }`
- `lowStockThreshold`: `number` (default 5)
- `emailDigest`: `{ enabled, frequency }`

---

## Proposed Changes

### Phase 0 - Foundation and Contracts
Goal: data contract and safe rollout rails finalize karna.

#### [UPDATE] `server/controllers/products/checkoutController.js`
- Checkout success par `Order` create karna before clearing cart.
- `purchase_success` retailer event emit/save karna.

#### [UPDATE] `server/controllers/products/productPageController.js`
- Product detail open (`getProductDetailPage`) par `product_view` event record karna.

#### [UPDATE] `server/controllers/products/cartController.js` + `checkoutController.js`
- `add_to_cart` and `buy_now_start` events record karna.

Deliverables:
- Analytics-ready data generation starts from day-1 of deployment.
- Existing buyer flow behavior unchanged.

---

### Phase 1 - Retailer Analytics Dashboard
Goal: actionable analytics panel for retailer.

#### [NEW] `server/services/analytics/retailerAnalyticsService.js`
Calculations:
- Total sales (`sum(grandTotal)`)
- Orders count
- Average order value
- Top products (by revenue + quantity)
- Conversion rate = `purchase_success / product_view`
- Pending replies count from `notificationHistory`

#### [NEW] `server/controllers/retailer/retailerAnalyticsController.js`
Endpoints:
- `GET /retailer/analytics` (HTML page)
- `GET /api/retailer/analytics/overview?range=7d|30d|90d|custom`
- `GET /api/retailer/analytics/top-products`
- `GET /api/retailer/analytics/conversion`

#### [NEW] `server/views/retailer_analytics.ejs`
UI blocks:
- KPI cards: Sales, Orders, AOV, Conversion, Pending Replies
- Top products table
- Conversion trend chart (day-wise)
- Filter by date range

#### [UPDATE] `server/routes/siteRoutes.js` or `[NEW] server/routes/retailerRoutes.js`
- Retailer-only route mount for analytics page and APIs.

---

### Phase 2 - Bulk Product Upload (CSV)
Goal: retailer ko large catalog fast upload capability dena.

#### [NEW] `server/middleware/upload/csvUploadMiddleware.js`
- `multer` with CSV mime/type + size checks.

#### [NEW] `server/services/bulk/csvImportService.js`
Pipeline:
1. Parse CSV
2. Normalize row
3. Validate using Joi-compatible product schema
4. Dry-run summary (valid/invalid count)
5. Commit mode (insert/update depending on strategy)

Import modes:
- `create_only` (existing SKU/name conflict -> error row)
- `upsert_by_name_brand` (safe default if no SKU yet)

#### [NEW] `server/controllers/retailer/retailerBulkController.js`
Endpoints:
- `GET /retailer/bulk/upload` (page)
- `GET /api/retailer/bulk/template.csv` (download template)
- `POST /api/retailer/bulk/upload/validate` (dry run)
- `POST /api/retailer/bulk/upload/commit` (actual write)

#### [NEW] `server/views/retailer_bulk_upload.ejs`
Features:
- Sample CSV format panel
- Upload + dry run results table
- Error rows with reason
- Commit button after successful validation

---

### Phase 3 - Bulk Edit
Goal: selected products par one-shot update.

#### [NEW] `server/services/bulk/bulkEditService.js`
Supported operations:
- Increase/decrease price by percent/fixed amount
- Set category/brand
- Set availability
- Set stock quantity for selected items

Safety:
- Max batch size (e.g., 500 products/request)
- Owner scoping enforced (`owner = req.user.id`)
- Audit metadata: who changed, when, count

#### [NEW] `server/controllers/retailer/retailerBulkController.js` (extend)
Endpoints:
- `GET /retailer/bulk/edit`
- `POST /api/retailer/bulk/edit/preview`
- `POST /api/retailer/bulk/edit/apply`

#### [NEW] `server/views/retailer_bulk_edit.ejs`
- Filter products
- Select checkboxes
- Choose operation
- Preview impact before apply

---

### Phase 4 - Notification Preferences (In-app + Email)
Goal: retailer control over alert fatigue and critical comms.

#### [NEW] `server/services/notifications/preferenceResolver.js`
- Check whether a given event should trigger in-app/email for retailer.

#### [NEW] `server/services/notifications/emailService.js`
- SMTP wrapper via `nodemailer`.
- Retry-safe function:
  `sendRetailerEmail({ retailerId, eventType, subject, html, text })`

#### [NEW] `server/controllers/retailer/retailerNotificationPrefController.js`
Endpoints:
- `GET /retailer/notification-preferences`
- `POST /retailer/notification-preferences`
- `GET /api/retailer/notification-preferences`
- `PATCH /api/retailer/notification-preferences`

#### [UPDATE] Notification trigger points
- `reviewController.js`: new review event -> in-app + optional email
- bulk import completion: summary email if enabled
- low-stock detector (scheduled or request-time hook): critical email if enabled

#### [NEW] `server/views/retailer_notification_preferences.ejs`
Controls:
- Channel toggles (in-app/email)
- Event toggles
- Critical-only mode
- Low-stock threshold

---

### Phase 5 - Dashboard Integration and UX Polish
Goal: existing dashboard ko unified operations hub banana.

#### [UPDATE] `server/views/dashboard.ejs`
- Add cards linking to:
  - Analytics
  - Bulk Upload
  - Bulk Edit
  - Notification Preferences
- Surface top-3 products + conversion snapshot.

#### [UPDATE] `server/controllers/siteController.js`
- Inject compact analytics summary for dashboard top section.

---

### Phase 6 - Reliability, Monitoring, and Guardrails
Goal: production-safe rollout.

#### [NEW] tests (recommended)
- Controller-level tests for analytics and bulk endpoints
- CSV validation edge cases
- Preference logic unit tests
- Order creation during checkout regression tests

#### [UPDATE] `server/package.json`
Add scripts:
- `dev`
- `start`
- `test`
- `lint` (if adopted)

#### [UPDATE] `.env.example` (if added)
Add:
- SMTP config keys
- feature flags:
  - `FEATURE_RETAILER_ANALYTICS=true`
  - `FEATURE_BULK_UPLOAD=true`
  - `FEATURE_BULK_EDIT=true`
  - `FEATURE_NOTIFICATION_PREFS=true`

---

## API Contracts (Draft)

### `GET /api/retailer/analytics/overview`
Response:
```json
{
  "range": "30d",
  "sales": 145000,
  "orders": 182,
  "aov": 796.7,
  "conversionRate": 3.8,
  "pendingReplies": 11
}
```

### `POST /api/retailer/bulk/upload/validate`
Response:
```json
{
  "totalRows": 220,
  "validRows": 208,
  "invalidRows": 12,
  "errors": [
    { "row": 17, "field": "price", "message": "price must be >= 0" }
  ]
}
```

### `PATCH /api/retailer/notification-preferences`
Request:
```json
{
  "channels": { "inApp": true, "email": true },
  "criticalOnly": false,
  "eventToggles": { "lowStock": true, "newReview": true, "csvImportSummary": true, "securityAlert": true },
  "lowStockThreshold": 5
}
```

---

## Milestones and Delivery Sequence

1. **M1 (Phase 0-1)**: order + events + analytics page/API
2. **M2 (Phase 2)**: CSV dry-run + commit upload
3. **M3 (Phase 3)**: bulk edit preview/apply
4. **M4 (Phase 4)**: notification preferences + SMTP emails
5. **M5 (Phase 5-6)**: dashboard integration + tests + hardening

Suggested implementation order for lowest risk:
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6

---

## Verification Plan

### Automated
1. Unit test analytics calculations with seeded orders/events.
2. Integration test checkout -> order created -> analytics reflects sale.
3. Integration test CSV validate/commit with mixed valid/invalid rows.
4. Unit test preference resolver for all toggle combinations.
5. Integration test notification trigger respects preferences.

### Manual Browser Testing
1. Retailer places simulated buyer orders and verifies analytics numbers.
2. CSV upload dry run catches malformed rows with correct row index.
3. Commit upload creates expected products only under retailer ownership.
4. Bulk edit preview matches final applied changes.
5. Notification preference toggles update behavior for in-app/email alerts.

### Performance Checks
1. Analytics endpoints with 10k+ orders should respond under acceptable latency.
2. CSV import of 2,000 rows should not block event loop excessively.

---

## Rollout and Backout Strategy

- Release behind feature flags, enable retailer-by-retailer.
- Keep existing dashboard functional if new analytics APIs fail.
- For CSV/bulk endpoints, enforce strict ownership and rate limiting.
- Backout path:
  1. Disable feature flags
  2. Keep created collections untouched (no destructive rollback)
  3. Restore old dashboard links

---

## Approval Gate

As requested, implementation **will start only after your explicit approval** of this roadmap.

Once approved, execution plan will be:
1. Implement **Phase 0 + Phase 1** first in one PR-sized batch
2. Share working demo/test notes
3. Continue phase-by-phase with your checkpoint approval

