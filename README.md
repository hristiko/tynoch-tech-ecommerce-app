# Tidewell

Tidewell is a full-stack e-commerce application developed as a software engineering internship project. It is a small online store with 16 sample products across four categories: Desk & Studio, Kitchen, Living, and Carry.

The purpose of the project is to demonstrate more than a storefront interface. Product browsing, shopping carts, wishlists, user accounts, and data persistence are handled by a Next.js backend connected to DynamoDB.

**Repository:** https://github.com/hristiko/tynoch-tech-ecommerce-app

Tidewell is a working demonstration store. Checkout, payments, order processing, and shipping are not implemented.

## Features

### Storefront

- Responsive homepage, category pages, product listings, and individual product pages.
- Search by product name and tags, category and price filters, and sorting.
- Product details, availability, ratings, and related products.
- Local product and category images, with source information documented where applicable.
- Loading indicators, empty states, input feedback, error handling, and a custom 404 page.

### Shopping cart and wishlist

- Add products to the cart, change quantities, and remove items.
- Show item counts and subtotals calculated from product prices in integer cents.
- Respect available stock and per-product quantity limits; handle unavailable products.
- Merge repeated additions into a single cart line.
- Protect concurrent cart updates using conditional DynamoDB writes and retries.
- Add or remove wishlist products without storing duplicates.

### Accounts

- Browse and use the cart or wishlist as a guest.
- Register with an email address and password; sign in and out.
- Keep each account's profile, cart, and wishlist separate from other accounts.
- Restore saved cart and wishlist items after signing in again.
- Import eligible guest items when signing into an account.
- Update the account's display name. Changing the registered email is not supported.

## Screenshots

The following screenshots show the completed application running locally.

### Homepage

![Tidewell homepage](docs/screenshots/homepage.png)

### Product catalogue and filters

![Product listing with search and filters](docs/screenshots/products.png)

### Product details

![Individual product details](docs/screenshots/product-details.png)

### Shopping cart

![Shopping cart with quantities and subtotal](docs/screenshots/cart.png)

### Wishlist

![Saved wishlist products](docs/screenshots/wishlist.png)

### Account

![Signed-in account page](docs/screenshots/account.png)

### Mobile layout

![Homepage on a mobile screen](docs/screenshots/mobile.png)

## Technology

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Backend and APIs | Next.js Route Handlers and server-side services |
| Database | AWS DynamoDB; DynamoDB Local in Docker for development |
| Authentication | NextAuth.js v4 with credentials-based login |
| Styling | Tailwind CSS |
| Input validation | Zod 4 |
| Testing | Vitest 5, DynamoDB Local checks, and HTTP API integration tests |
| Version control | Git and GitHub |

## Architecture

The application separates the interface, business rules, and database operations. Server-rendered pages can call the service layer directly; browser actions use the API routes.

```text
Browser / React components
          |
          v
Next.js pages and API routes
          |
          v
Services (catalogue, cart, wishlist, accounts)
          |
          v
DynamoDB repositories
          |
          v
DynamoDB
```

For example, when a customer adds a product to the cart, the API validates the request and calls the cart service. The service checks product availability and quantity limits, updates the cart record in DynamoDB, and returns the recalculated cart. Conditional writes prevent simultaneous requests from silently overwriting one another.

### Project structure

```text
src/
  app/                  Pages, loading/error pages and API endpoints
  components/           Reusable interface components
  services/             Catalogue, cart, wishlist and account rules
  db/                   DynamoDB client, keys and repositories
  lib/                  Authentication, validation and shared helpers
  types/                Shared TypeScript definitions
scripts/                Database setup, seed data and integration checks
tests/                  Vitest unit tests
public/images/          Local product and category images
docs/                   Technical guides and screenshots
compose.yaml            Persistent DynamoDB Local configuration
```

## Database design

Tidewell uses a single DynamoDB table, named `tidewell-store` by default, with `PK` (partition key) and `SK` (sort key) attributes. Two secondary indexes support product and category listings.

| Record type | Example key pair | What it stores |
| --- | --- | --- |
| Product | `PRODUCT#id` / `METADATA` | Details, price, stock and image paths |
| Category | `CATEGORY#slug` / `METADATA` | Category information and image |
| User profile | `USER#id` / `PROFILE` | Name and email |
| Account credentials | `USER#acct-id` / `CREDENTIALS` | Salted password hash |
| Email lookup | `AUTH_EMAIL#hash` / `LOOKUP` | Unique email-to-account mapping |
| Cart item | `USER#id` / `CART#productId` | Quantity and update version |
| Wishlist item | `USER#id` / `WISHLIST#productId` | A saved product |
| Rate-limit counter | `RATE#scope#hash` / `WINDOW#number` | Authentication attempt counts |

Product and category reads use DynamoDB queries and item lookups. Registration creates the related account records in a transaction. Cart updates use version-aware conditional writes; wishlist writes prevent duplicate entries.

Search and price filtering are performed in the service layer after fetching the small sample catalogue. This is suitable for the current project but would need a more scalable search approach for a much larger store.

## Run the application locally

### Requirements

- Node.js 22.12 or newer and npm.
- Docker Desktop with Docker Compose.
- Git.

These instructions use Windows PowerShell. The Next.js application runs on your computer, while DynamoDB Local runs inside Docker.

### 1. Clone the repository and install dependencies

```powershell
git clone https://github.com/hristiko/tynoch-tech-ecommerce-app.git
cd tynoch-tech-ecommerce-app
npm ci
```

### 2. Configure the environment

Copy the example configuration:

```powershell
Copy-Item .env.example .env.local
```

For local development, set these values in `.env.local`:

```dotenv
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
DYNAMODB_TABLE_NAME=tidewell-store
DYNAMODB_ENDPOINT=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=REPLACE_WITH_YOUR_GENERATED_SECRET
AUTH_TRUST_PROXY=false
```

Generate a secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Replace the `NEXTAUTH_SECRET` placeholder with the generated value. The AWS credentials shown above are dummy values for DynamoDB Local. **Never commit `.env.local` or actual credentials.**

### 3. Start DynamoDB Local

For a **new installation**, create the persistent database container:

```powershell
docker compose up -d
```

The provided `compose.yaml` configures a Docker volume so data survives container restarts. It also initializes the volume permissions required by DynamoDB Local.

If you already have the working `tidewell-dynamodb` container, **do not start Compose alongside it**. Start the existing container instead:

```powershell
docker start tidewell-dynamodb
```

The database is available at `http://localhost:8000`. For setup details, see [Local DynamoDB setup](docs/LOCAL_DYNAMODB.md).

### 4. Create the table and sample catalogue

**Only for a new, empty database:**

```powershell
npm run db:create
npm run db:seed
```

These commands create the table and load the sample products and categories. Do not reseed an existing database merely to restart the application, since seed data may overwrite product information.

### 5. Start Tidewell

```powershell
npm run dev
```

Open **http://localhost:3000** in your browser.

For a production-style local build, run:

```powershell
npm run build
npm run start
```

This setup is local. Running DynamoDB in Docker does **not** make the storefront publicly available.

### Persistence notes

The Docker volume is named `tidewell-dynamodb-data`. It retains database records after a normal stop or restart, but is not a backup. Avoid `docker compose down -v` or other commands that remove the volume if you want to keep existing accounts and cart data.

## API endpoints

Successful responses generally contain `data`; failures contain an `error` object. Input validation and ownership checks are handled on the server.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/products` | List, search, filter and sort products |
| `GET` | `/api/products/[id]` | Product details and related products |
| `GET` | `/api/categories` | List categories |
| `GET`, `POST` | `/api/cart` | View cart or add an item |
| `PATCH`, `DELETE` | `/api/cart/[productId]` | Change quantity or remove an item |
| `GET`, `POST` | `/api/wishlist` | View wishlist or save an item |
| `DELETE` | `/api/wishlist/[productId]` | Remove a saved item |
| `GET`, `PUT` | `/api/user` | View or update a profile |
| `POST` | `/api/auth/register` | Register an account |
| NextAuth routes | `/api/auth/[...nextauth]` | Login, session and logout |
| `POST` | `/api/account/import-guest` | Import eligible guest shopping data |

## Authentication and security

Passwords are not stored in plain text. They are hashed using Node.js `scrypt` with a random salt. NextAuth manages signed-in sessions, while guests are identified using an HMAC-signed cookie. Registered accounts are resolved from the server-side session rather than from user IDs supplied by the browser.

Additional safeguards include Zod validation, origin checks on state-changing requests, rate limits for login and registration, conditional DynamoDB writes, and controlled error responses. These features reduce common mistakes, but the application has not undergone a full production security audit.

The following capabilities are not included: email verification, password recovery, account deletion, multi-factor authentication, and production operational monitoring.

Further details are in [Authentication](docs/AUTHENTICATION.md), [Authentication rate limiting](docs/AUTH_RATE_LIMITING.md), [Guest-session security](docs/GUEST_SESSION_SECURITY.md), and [Cart consistency](docs/CART_CONSISTENCY.md).

## Testing

Run the standard checks from the project root:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm audit
```

The Vitest suite covers cart rules, catalogue filtering, account password hashing, rate limiting, and guest-identity signing.

With DynamoDB Local running, run the database checks:

```powershell
npm run db:test-cart
npx tsx scripts/check-auth-rate-limit.ts
```

To test account isolation through the real HTTP API, keep both DynamoDB Local and the Next.js application running, then execute in a separate terminal:

```powershell
node --env-file=.env.local scripts/check-api-isolation.mjs
```

That script uses temporary test accounts to verify registration, login, cart and wishlist separation, profile ownership, invalid requests, and logout behavior. It removes the temporary account records afterward and refuses to use a nonlocal DynamoDB endpoint.

## Product images

The sample catalogue is defined in `scripts/seed-data.ts`. Product and category images are stored under `public/images/` and referenced by their paths in DynamoDB. The images are illustrative examples for this demonstration store.

For an existing database, use the image-only updater rather than reseeding products:

```powershell
node --env-file=.env.local scripts/update-catalog-images.mjs
node --env-file=.env.local scripts/update-catalog-images.mjs --apply
```

The first command checks the required files and records without modifying the database. The second updates the stored image references. See [Product images](docs/PRODUCT_IMAGES.md) and [Image credits](docs/IMAGE_CREDITS.md) for details and source attribution.

## Current scope and limitations

Tidewell demonstrates browsing and managing a small online catalogue with real server-side persistence. It does not process orders, charge customers, calculate final shipping costs, or reserve inventory at checkout. The checkout control is deliberately inactive.

The project is intended to run locally for development and evaluation. Deploying it publicly would require an accessible database, secure production configuration, additional account-recovery controls, and operational monitoring.
