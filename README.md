# Tidewell: Production-Style E-Commerce Application

A full-stack e-commerce storefront built with **Next.js 14 (App Router), React, TypeScript, Tailwind CSS and AWS DynamoDB**. Visitors can browse and search products, filter by category and price, manage a cart and a wishlist, and edit a profile. All data flows through a layered server architecture, not through hardcoded arrays.

## Features

**Storefront**
- Responsive homepage (hero, category tiles, top-rated products)
- Product listing with search, category filter, price range and sorting (filters live in the URL, so links are shareable and the form works without JavaScript)
- Product detail page with image gallery, stock status, tags and related products
- Custom 404 page, global error boundary, loading skeletons and empty states

**Cart**
- Add to cart with quantity, update quantity, remove item
- Subtotal and item count computed on the server in integer cents
- Adding the same product twice merges into one line (no duplicates)
- Quantity capped by stock and a per-item maximum (10)
- Live cart count in the header

**Wishlist**
- Toggle from any product card or detail page (optimistic UI with rollback on failure)
- Duplicates are prevented at the database level with a conditional write

**User data**
- Anonymous visitors can shop using a browser cookie; account sessions take priority when signed in
- Registration, password-based sign-in and sign-out using NextAuth.js (JWT sessions)
- Account profiles, password hash records and unique email lookups in DynamoDB (atomic transaction)
- Guest cart/wishlist items are imported into the account after successful sign-in; existing account quantities win on overlaps
- Account email is read-only after registration; password reset and email verification are not implemented

See [Authentication details](docs/AUTHENTICATION.md) for account record keys, the guest-import behavior, and security limitations.

**Engineering**
- Layered code: UI → services → repositories → DynamoDB
- Zod validation on every API input, consistent JSON error format, safe error messages
- Environment-based configuration, no credentials in code
- Unit tests for business rules and validation (Vitest)

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 14 (App Router, Route Handlers), React 18 |
| Language | TypeScript (strict) |
| Database | AWS DynamoDB (single-table design, on-demand billing) |
| Styling | Tailwind CSS |
| Validation | Zod |
| Authentication | NextAuth.js v4 Credentials provider, JWT sessions, Node scrypt password hashing |
| Testing | Vitest |
| Version control | Git & GitHub |

## Architecture

```
User → Next.js Application → Server/API Layer → AWS DynamoDB

Browser (React components)
   │  fetch /api/*  (mutations)          Server Components render pages directly
   ▼                                      from the same service layer
Route Handlers  (src/app/api/**)  ← parse + validate input (Zod), map errors to HTTP
   ▼
Services        (src/services/**) ← business rules: stock limits, merge quantities,
   ▼                                 subtotal, search/sort, related products
Repositories    (src/db/repositories/**) ← only place that builds DynamoDB commands
   ▼
DynamoDB        (single table, 2 GSIs)
```

Server Components call services directly for reads (no extra HTTP hop). Client components call the Route Handlers for mutations (cart, wishlist, profile), then refresh the router so the header badge and lists stay in sync.

## Project structure

```
src/
  app/                    Routes (pages) and API route handlers
    api/                  REST endpoints (products, categories, cart, wishlist, user)
    products/[id]/        Product detail
    cart/ wishlist/ account/
    error.tsx not-found.tsx loading.tsx
  components/             Reusable UI (ProductCard, CartList, FilterBar, ...)
  services/               Business logic (catalog, cart, cartLogic, wishlist, user)
  db/
    client.ts             DynamoDB DocumentClient (singleton)
    keys.ts               Key builders for the single-table design
    errors.ts             AWS error → AppError mapping
    repositories/         CRUD per entity
  lib/                    env, errors, validation (Zod), session, api helpers, utils
  types/                  Shared TypeScript interfaces
scripts/                  create-table.ts, seed.ts, seed-data.ts
tests/                    Unit tests
docs/screenshots/         Screenshots for submission
```

## DynamoDB design

One table (`tidewell-store` by default) with on-demand capacity and two global secondary indexes. Single-table design keeps a user's cart, wishlist and profile in one partition, so they load in one `Query`.

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|---|---|---|---|---|
| Product | `PRODUCT#<id>` | `METADATA` | `CATEGORY#<slug>` / `<createdAt>` | `TYPE#PRODUCT` / `<createdAt>#<id>` |
| Category | `CATEGORY#<slug>` | `METADATA` | | `TYPE#CATEGORY` / `<name>` |
| User | `USER#<id>` | `PROFILE` | | |
| Credentials | `USER#acct-<id>` | `CREDENTIALS` | | |
| Email uniqueness | `AUTH_EMAIL#<sha256(normalized-email)>` | `LOOKUP` | | |
| Cart item | `USER#<id>` | `CART#<productId>` | | |
| Wishlist item | `USER#<id>` | `WISHLIST#<productId>` | | |

### Access patterns and CRUD

| Operation | DynamoDB call |
|---|---|
| Get a product | `GetItem` PK=`PRODUCT#id`, SK=`METADATA` |
| Get products for a cart or wishlist | `BatchGetItem` on product keys |
| List all products (newest first) | `Query` GSI2, `GSI2PK = TYPE#PRODUCT`, descending |
| List products in a category | `Query` GSI1, `GSI1PK = CATEGORY#<slug>` |
| List categories | `Query` GSI2, `GSI2PK = TYPE#CATEGORY` |
| Search / filter / sort | Query above, then filtered in the service layer (see note) |
| Create or update product / category | `PutItem` (seed script) |
| Create user | `PutItem` with `attribute_not_exists(PK)` (idempotent) |
| Update profile | `UpdateItem` with `attribute_exists(PK)` condition |
| Read cart | `Query` PK=`USER#id`, `begins_with(SK, "CART#")` |
| Add to cart | `GetItem` existing line, merge quantity, `PutItem` |
| Update quantity | `GetItem` + `PutItem` (clamped to stock) |
| Remove from cart | `DeleteItem` (idempotent) |
| Read wishlist | `Query` PK=`USER#id`, `begins_with(SK, "WISHLIST#")` |
| Add to wishlist | `PutItem` with `attribute_not_exists(PK)`; condition failure means "already saved" |
| Remove from wishlist | `DeleteItem` |

> **Note on search:** DynamoDB has no full-text search. For a catalogue of this size the service filters in memory after a key-based query. For a large catalogue, move text search to OpenSearch/Algolia and keep DynamoDB as the source of truth.

Prices are stored as integer cents. Cart lines store only `productId` and `quantity`; price and name come from the product record at read time, so the cart always reflects the current price.

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Description |
|---|---|
| `AWS_REGION` | Region of the DynamoDB table (e.g. `eu-central-1`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Optional. Leave empty to use the default AWS credential chain (`aws configure`, SSO, IAM role) |
| `DYNAMODB_TABLE_NAME` | Table name, default `tidewell-store` |
| `DYNAMODB_ENDPOINT` | Optional. Set to `http://localhost:8000` to use DynamoDB Local |
| `NEXTAUTH_URL` | App origin, e.g. `http://localhost:3000` for local development |
| `NEXTAUTH_SECRET` | Random secret for encrypted sessions; generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |

`.env*` files are git-ignored. Never commit credentials.

## DynamoDB setup

**Option A: AWS account**
1. Create an IAM user (or use SSO) with the minimal policy below, and run `aws configure` (or set the env vars).
2. Set `AWS_REGION` and `DYNAMODB_TABLE_NAME` in `.env.local`.
3. Create the table and indexes, then load sample data:
   ```bash
   npm run db:create
   npm run db:seed
   ```

**Option B: DynamoDB Local (no AWS account needed)**
```bash
docker run -p 8000:8000 amazon/dynamodb-local
# in .env.local
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
npm run db:create && npm run db:seed
```

Minimal IAM policy for the app (replace region/account):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:BatchGetItem"],
    "Resource": [
      "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/tidewell-store",
      "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/tidewell-store/index/*"
    ]
  }]
}
```
(`db:create` additionally needs `dynamodb:CreateTable` and `dynamodb:DescribeTable`; use an admin profile for that one-off step.)

## Installation

Requirements: Node.js 18.17+ and npm.

```bash
git clone <your-repo-url>
cd tidewell
npm install
cp .env.example .env.local     # then edit values
npm run db:create
npm run db:seed
npm run dev                    # http://localhost:3000
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## API reference

All responses are `{ "data": ... }` on success or `{ "error": { "code", "message" } }` on failure.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/products?q=&category=&min=&max=&sort=` | Search and filter products |
| GET | `/api/products/:id` | Product plus related products |
| GET | `/api/categories` | List categories |
| GET / POST | `/api/cart` | Read cart / add `{ productId, quantity }` |
| PATCH / DELETE | `/api/cart/:productId` | Set quantity `{ quantity }` / remove |
| GET / POST | `/api/wishlist` | Read wishlist / add `{ productId }` |
| DELETE | `/api/wishlist/:productId` | Remove from wishlist |
| GET / PUT | `/api/user` | Read / update `{ name, email }` |

Status codes: `400` validation, `404` not found, `409` out of stock, `503` database unavailable or misconfigured, `500` unexpected.

## Error handling and validation

- Route Handlers are wrapped by `handle()`, which converts Zod errors, `AppError`s and unknown errors into the JSON format above. Internal details are logged, not leaked.
- `src/db/errors.ts` maps AWS errors (missing table, throttling, bad credentials) to friendly messages.
- UI: error boundary (`error.tsx`), 404 (`not-found.tsx`), loading skeletons, empty states for cart, wishlist and search, inline form errors, and optimistic updates that roll back on failure.
- Non-critical data (cart badge, wishlist hearts) degrades to defaults if the database is unreachable instead of breaking the page.

## Testing

`npm test` runs Vitest unit tests for the pure business rules (quantity clamping, merging, subtotal, search/sort) and Zod schemas. Manual test checklist:
1. Add the same product twice: one cart line, quantity 2.
2. Try to exceed stock: quantity stops at the stock limit.
3. Heart a product twice: only one wishlist record.
4. Visit `/products/does-not-exist`: custom 404.
5. Search for a term with no matches: empty state.
6. Submit the profile form with a bad email: inline error, no request sent.

## Deployment (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `DYNAMODB_TABLE_NAME` as environment variables (use an IAM user with the minimal policy above).
3. Run `npm run db:create && npm run db:seed` once against the production table.
4. Deploy and test the live URL.

## Known limitations and next steps

- Guests are identified by cookie only; add real authentication (NextAuth/Cognito) and merge guest data on sign-in.
- Checkout and payments are out of scope.
- Search is in-memory; use a search service for large catalogues.
- Cart updates are read-then-write; for very high concurrency use `UpdateItem` with `ADD` and a condition on stock.

## Screenshots

Add screenshots to `docs/screenshots/` (home, product list with filters, product detail, cart, wishlist, empty state, 404, mobile view) and link them here.
