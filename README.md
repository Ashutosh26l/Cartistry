# Ecommerce (Sem-6)

Updated role-based ecommerce platform built with **Node.js + Express 5 + MongoDB + EJS**.

## What This Project Does
This is a server-rendered ecommerce app with two active roles:

- **Buyer**: browse products, filter/search catalog, manage cart and wishlist, place order, post reviews.
- **Retailer**: manage own products, monitor buyer review notifications, reply to reviews.

The codebase supports both:
- HTML page routes (`/auth/*`, `/products/*`, etc.)
- JSON API routes (`/api/auth/*`, `/api/products/*`, `/api/health`)

## Updated Tech Stack

| Layer | Stack |
|---|---|
| Runtime | Node.js |
| Backend | Express `5.x` (ES Modules) |
| Database | MongoDB |
| ODM | Mongoose `9.x` |
| Views | EJS |
| Auth | JWT (stored in `httpOnly` cookie) |
| Validation | Joi |
| Password Hashing | bcryptjs |
| Sessions / Flash | express-session + connect-flash |
| Security | Helmet, custom CSRF middleware, express-rate-limit, cookie-parser, CORS |
| Email | Nodemailer (optional SMTP notifications) |
| Realtime | Socket.IO (WebSocket/polling fallback) |
| Styling | Tailwind CSS `4.x` config + custom CSS/JS |
| Frontend libs (installed) | GSAP, Howler, Three.js, Vue 3, Pinia |

## Key Features (Current)

- Role auto-assignment by email domain (`@tri.com` => `retailer`, else `buyer`)
- Login/register for both HTML and API flows
- JWT-based auth guard for pages + APIs
- Product CRUD for retailer-owned resources
- Product catalog with search, category/brand filters, price/availability filters, pagination, sorting
- Product details with gallery/variant support
- Buyer cart and wishlist flows
- Buy-now checkout with stock validation and quantity deduction
- Buyer review posting
- Retailer review reply flow
- Live review/reply updates on product detail pages via Socket.IO
- Retailer notification center (pending + history) with realtime badge/dropdown updates
- Buyer notification center (new replies + conversation history) with realtime updates
- Buyer online popup alert when retailer replies
- Offline-safe notification persistence in `notificationHistory` (combined history model)
- Retailer analytics dashboard + analytics APIs (overview, top products, conversion)
- Retailer bulk product upload via CSV (preview + commit) and bulk edit operations
- Retailer notification preferences (page + API patch)
- Flash messages for UX feedback
- Theme toggle + frontend behavior scripts
- Health endpoints for app/API checks

## Project Structure

```text
Ecommerce(sem-6)/
|-- server/
|   |-- app.js
|   |-- index.js
|   |-- package.json
|   |-- realtime/
|   |   `-- socketServer.js
|   |-- config/
|   |   |-- db.js
|   |   |-- cors.js
|   |   `-- session.js
|   |-- controllers/
|   |   |-- authController.js
|   |   |-- debugController.js
|   |   |-- siteController.js
|   |   |-- productController.js
|   |   |-- retailer/
|   |   `-- products/
|   |-- middleware/
|   |   |-- auth.js
|   |   |-- csrf.js
|   |   |-- errorHandlers.js
|   |   |-- rateLimit.js
|   |   |-- flashMessages.js
|   |   |-- retailerNotifications.js
|   |   `-- validation/
|   |-- models/
|   |   |-- userModel.js
|   |   |-- productModel.js
|   |   |-- orderModel.js
|   |   |-- retailerEventModel.js
|   |   |-- retailerPreferenceModel.js
|   |   `-- notificationHistoryModel.js
|   |-- routes/
|   |   |-- authRoutes.js
|   |   |-- productRoutes.js
|   |   |-- productApiRoutes.js
|   |   |-- siteRoutes.js
|   |   |-- retailerRoutes.js
|   |   `-- debugRoutes.js
|   |-- scripts/
|   |   `-- backfillNotificationHistory.js
|   |-- Dockerfile
|   |-- public/
|   |-- views/
|   |   |-- buyer_notifications.ejs
|   |   |-- retailer_analytics.ejs
|   |   |-- retailer_bulk_upload.ejs
|   |   |-- retailer_bulk_edit.ejs
|   |   `-- retailer_notification_preferences.ejs
|   `-- tailwind.config.js
`-- README.md
```

## Routes Snapshot

### Site
- `GET /`
- `GET /health`
- `GET /api/health`
- `GET /help-center`
- `GET /returns`
- `GET /shipping`

### Auth (`/auth` and `/api/auth`)
- `GET /register`
- `GET /login`
- `POST /register`
- `POST /login`
- `POST /logout`

### Product Pages (`/products`)
- `GET /allProducts`
- `GET/POST /new` (retailer)
- `GET/POST /edit/:id` (retailer)
- `POST /:id/delete` (retailer)
- `GET /notifications` (retailer)
- `GET /my-notifications` (buyer)
- `POST /notifications/:notificationId/read` (retailer)
- `GET /cart` (buyer)
- `GET /wishlist` (buyer)
- `POST /:id/cart` (buyer)
- `POST /:id/cart/update` (buyer)
- `POST /:id/cart/remove` (buyer)
- `POST /:id/wishlist` (buyer)
- `POST /:id/reviews` (buyer)
- `POST /:id/reviews/:reviewIndex/reply` (retailer)
- `POST /:id/buy-now/start` (buyer)
- `GET /:id/buy-now` (buyer)
- `POST /:id/buy-now` (buyer)
- `GET /:id`

## Realtime Events (Socket.IO)

The server initializes Socket.IO in `server/index.js` and manages rooms in `server/realtime/socketServer.js`.

- Product room (`product:<productId>`)
  - `review:created` when buyer posts a review
  - `review:replied` when retailer replies to a review

- Retailer room (`retailer:<retailerId>`)
  - `retailer:notification:new` when a new buyer review needs reply
  - `retailer:notification:replied` when the thread moves to replied/history state

- Buyer room (`buyer:<buyerId>`)
  - `buyer:notification:new` when retailer replies to buyer review

If a user is offline, notifications are still persisted in `notificationHistory` and rendered later from history pages.

### Product API (`/api/products`) - retailer scoped
- `GET /`
- `POST /`
- `PUT /:id`
- `PATCH /:id`
- `DELETE /:id`

### Retailer Pages/APIs (`/retailer`, `/api/retailer`) - retailer scoped
- `GET /retailer/analytics`
- `GET /retailer/bulk/upload`
- `GET /retailer/bulk/template.csv`
- `POST /retailer/bulk/upload/preview`
- `POST /retailer/bulk/upload/commit`
- `GET /retailer/bulk/edit`
- `POST /retailer/bulk/edit/preview`
- `POST /retailer/bulk/edit/apply`
- `GET /retailer/notification-preferences`
- `POST /retailer/notification-preferences`
- `GET /api/retailer/analytics/overview`
- `GET /api/retailer/analytics/top-products`
- `GET /api/retailer/analytics/conversion`
- `GET /api/retailer/notification-preferences`
- `PATCH /api/retailer/notification-preferences`

## Environment Variables
Create `server/.env`:

```env
PORT=5500
MONGO_URI=mongodb://localhost:27017/ecoEcom-backend
JWT_SECRET=replace_with_strong_secret
SESSION_SECRET=replace_with_strong_secret
COOKIE_SECRET=replace_with_strong_secret
CORS_ORIGIN=http://localhost:5500
NODE_ENV=development
ENABLE_HSTS=false
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Notes:
- `CORS_ORIGIN` supports comma-separated values.
- Keep all secrets strong in production.

## Setup and Run

1. Go to server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Add `server/.env` values.
4. Start server:
   ```bash
   node index.js
   ```
5. Open:
   - `http://localhost:5500`

## Available Scripts (`server/package.json`)

- `npm test`
  - placeholder script (currently exits with error)
- `npm run backfill:notifications`
  - backfills `notificationHistory` from existing product reviews

## Security Implementations

- Helmet security headers
- Rate limiter on auth route groups
- JWT in `httpOnly` cookie
- CSRF token cookie + token verification for unsafe methods
- Joi validations for product/review/reply payloads
- Role-based route protection (buyer/retailer)

## Current Gaps / Notes

- No automated test suite yet
- No `start` / `dev` script yet (currently run with `node index.js`)
- `client/` folder exists but has no active app code right now
- `seed.js` is currently a placeholder

## License
ISC (as defined in `server/package.json`)
