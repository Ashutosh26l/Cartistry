# Ecommerce (Sem-6)

A role-based ecommerce web application built with **Node.js, Express, MongoDB, and EJS**.

This project supports two primary user roles:
- **Buyer**: browse products, add reviews, manage cart and wishlist, and place orders.
- **Retailer**: create, edit, and manage their own product inventory.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [Tech Stack](#tech-stack)
4. [Tools and Libraries](#tools-and-libraries)
5. [Project Structure](#project-structure)
6. [Architecture and Flow](#architecture-and-flow)
7. [Routes and Endpoints](#routes-and-endpoints)
8. [Environment Variables](#environment-variables)
9. [Local Setup and Run](#local-setup-and-run)
10. [Security Implementations](#security-implementations)
11. [Current Limitations](#current-limitations)
12. [Future Improvements](#future-improvements)
13. [License](#license)

## Project Overview
This is a server-rendered ecommerce application where:
- authentication is handled with JWT stored in cookies,
- product data is stored in MongoDB,
- role-based access controls what users can do,
- buyers can complete a basic checkout flow,
- retailers can manage their own product catalog.

The backend also exposes JSON APIs for auth and product operations.

## Core Features
- User registration and login
- Automatic role assignment (`@tri.com` users become `retailer`, others become `buyer`)
- JWT-based authentication using cookies
- Role-based access control for buyer and retailer pages
- CSRF token protection for form/API write requests on protected route groups
- Product CRUD (retailer-owned resources)
- Product availability and quantity-based stock handling
- Product listing with search/filter support
- Product detail pages with review posting
- Buyer cart management
- Wishlist add/remove toggling
- Buy-now / checkout flow with shipping calculation and stock validation
- Flash messages for user feedback
- Dark mode toggle support on frontend

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Backend Framework | Express 5 |
| Database | MongoDB |
| ODM | Mongoose |
| Templating Engine | EJS |
| Auth Token | JSON Web Token (JWT) |
| Password Hashing | bcryptjs |
| Validation | Joi |
| Styling | Tailwind CSS (configured), custom CSS classes in views |
| Session / Flash | express-session, connect-flash |

## Tools and Libraries
| Category | Package / Tool | Purpose |
|---|---|---|
| Security | `helmet` | Secure HTTP headers |
| Security | `express-rate-limit` | Auth endpoint rate limiting |
| Security | custom CSRF middleware | CSRF protection for unsafe methods |
| Cookies | `cookie-parser` | Parse and sign cookies |
| CORS | `cors` | Origin-based request control |
| Config | `dotenv` | Environment variable loading |
| API/Auth | `jsonwebtoken` | Generate and verify JWT |
| Validation | `joi` | Request schema validation |
| Database | `mongoose` | Models and DB interaction |
| UI | `ejs` | Server-side rendering |
| Dev Styling | `tailwindcss` | Utility-first CSS framework |

## Project Structure
```text
Ecommerce(sem-6)/
|-- server/
|   |-- config/
|   |   `-- db.js
|   |-- controllers/
|   |   |-- authController.js
|   |   `-- productController.js
|   |-- middleware/
|   |   |-- auth.js
|   |   |-- csrf.js
|   |   `-- validation.js
|   |-- models/
|   |   |-- productModel.js
|   |   `-- userModel.js
|   |-- public/
|   |   |-- js/
|   |   |   |-- bootstrap-validation.js
|   |   |   |-- search.js
|   |   |   `-- theme.js
|   |   `-- *.jpg
|   |-- routes/
|   |   |-- authRoutes.js
|   |   |-- productApiRoutes.js
|   |   `-- productRoutes.js
|   |-- views/
|   |   |-- partials/
|   |   `-- *.ejs
|   |-- index.js
|   |-- package.json
|   `-- tailwind.config.js
|-- client/                 # currently empty
`-- .gitignore
```

## Architecture and Flow
1. Client sends request to Express routes.
2. Middleware chain applies:
   - cookie parsing,
   - session/flash,
   - CORS,
   - security headers,
   - auth context attachment,
   - CSRF token generation/verification.
3. Controllers handle business logic.
4. Mongoose models read/write MongoDB.
5. Response is returned as:
   - EJS page for browser routes, or
   - JSON for API routes.

## Routes and Endpoints
### Health Check
- `GET /api/health` - API status message

### Authentication Routes
Both `/auth/*` (HTML flow) and `/api/auth/*` (JSON flow) are implemented.

- `GET /auth/register`
- `GET /auth/login`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

Equivalent API base:
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`

### Product API Routes (`/api/products`)
- `GET /api/products` - list authenticated retailer products
- `POST /api/products` - create product
- `PUT /api/products/:id` - full update
- `PATCH /api/products/:id` - partial update
- `DELETE /api/products/:id` - delete product

### Product Page Routes (`/products`)
- `GET /products/allProducts`
- `GET /products/new` (retailer only)
- `POST /products/new` (retailer only)
- `GET /products/edit/:id` (retailer only)
- `POST /products/edit/:id` (retailer only)
- `GET /products/cart` (buyer only)
- `GET /products/wishlist` (buyer only)
- `POST /products/:id/cart` (buyer only)
- `POST /products/:id/cart/update` (buyer only)
- `POST /products/:id/cart/remove` (buyer only)
- `POST /products/:id/wishlist` (buyer only)
- `GET /products/:id/buy-now` (buyer only)
- `POST /products/:id/buy-now` (buyer only)
- `POST /products/:id/reviews`
- `GET /products/:id`

## Environment Variables
Create a `.env` file inside the `server/` directory.

```env
PORT=5500
MONGO_URI=mongodb://localhost:27017/ecoEcom-backend
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
COOKIE_SECRET=your_cookie_secret_here
CORS_ORIGIN=http://localhost:5500
NODE_ENV=development
```

Notes:
- `PORT` defaults to `5500` if not provided.
- `CORS_ORIGIN` supports comma-separated values.
- `SESSION_SECRET`, `JWT_SECRET`, and `COOKIE_SECRET` must be strong values in production.

## Local Setup and Run
### Prerequisites
- Node.js (LTS recommended)
- npm
- MongoDB (local or cloud)

### Steps
1. Move to server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `server/.env`.
4. Start the app:
   ```bash
   node index.js
   ```
5. Open in browser:
   - `http://localhost:5500`

## Security Implementations
- Helmet is enabled for secure default headers.
- Rate limiting is applied on auth API routes.
- JWT token is stored as `httpOnly` cookie.
- CSRF token middleware is used for state-changing operations.
- Joi validation enforces product/review payload shape.
- Role-based middleware restricts buyer/retailer access.

## Current Limitations
- No automated test suite configured yet.
- `npm test` is currently a placeholder script.
- Tailwind build pipeline scripts are not yet defined in `package.json`.
- `client/` directory is present but currently unused.

## Future Improvements
- Add `start`, `dev`, and `test` scripts.
- Add automated tests (unit + integration).
- Add order history and payment gateway integration.
- Add image upload/storage support (Cloudinary/S3).
- Add admin analytics dashboard.
- Add CI/CD pipeline and environment-based deployment docs.

## License
Currently set as `ISC` (as per `server/package.json`).
