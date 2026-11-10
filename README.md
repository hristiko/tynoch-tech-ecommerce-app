# Tidewell

Tidewell is a small online store built for a software engineering internship project. It sells a sample catalogue of home, desk, kitchen and everyday-carry products. The focus is on how the application works: browsing products, keeping a cart and wishlist, managing accounts, and storing data in DynamoDB.

This is a working storefront, not a checkout service. Payments, order processing and delivery tracking are outside the scope of the project.

## What you can do

- Browse products by category, search by name or tags, filter by price and sort the results. Product pages show descriptions, stock availability and related items.
- Add products to a cart, change quantities, remove items and see an updated subtotal. Prices are calculated in integer cents to avoid floating-point rounding errors.
- Save and remove wishlist items without creating duplicates.
- Shop as a guest or register with an email and password. An account keeps its own cart, wishlist and profile. Guest items can be imported after signing in.
- Use the store on desktop or mobile. Pages have loading states, empty results, form feedback and a custom not-found page.

The catalogue comes from seed data in `scripts/seed-data.ts`. Images are served locally from `public/images`. They illustrate sample products rather than specific manufacturer listings. For picture sources, review and the image-only DynamoDB update, see [Product images](docs/PRODUCT_IMAGES.md).

## Technology

| Part | Used in this project |
| --- | --- |
| Pages and API | Next.js 16.4.6, React 19, App Router and Route Handlers |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | DynamoDB, including DynamoDB Local in Docker |
| Accounts | NextAuth.js v4, credentials login and `scrypt` password hashes |
| Input validation | Zod 4 |
| Tests | Vitest 5 and DynamoDB/API integration scripts |
| Source control | Git and GitHub |

## Run it locally

You need **Node.js 22.12 or newer**, npm and Docker Desktop with Docker Compose. The commands below use Windows PowerShell.

```powershell
git clone https://github.com/hristiko/tynoch-tech-ecommerce-app.git
cd tynoch-tech-ecommerce-app
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` for the local database:

```dotenv
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
DYNAMODB_TABLE_NAME=tidewell-store
DYNAMODB_ENDPOINT=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=REPLACE_WITH_A_GENERATED_SECRET
AUTH_TRUST_PROXY=false
```

Create a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Paste the generated value into `NEXTAUTH_SECRET`. Don't share or commit `.env.local`.

**On a new computer**, start DynamoDB with the supplied persistent-volume configuration:

```powershell
docker compose up -d
```

**If you already have the working `tidewell-dynamodb` container**, don't start Compose alongside it. Start the existing container instead:

```powershell
docker start tidewell-dynamodb
```

Only when setting up a **new, empty database**, create its table and load the sample catalogue:

```powershell
npm run db:create
npm run db:seed
```

Start the application:

```powershell
npm run dev
```

Open `http://localhost:3000`. The Next.js app runs on your computer; Docker runs the database on port 8000. Neither becomes a public website just because Docker is running.

For the Docker volume, permissions, stopping/restarting containers and avoiding data loss, see [Local DynamoDB setup](docs/LOCAL_DYNAMODB.md). In particular, **do not run `docker compose down -v`** on a database containing data you want to keep.

## How the application is organized

The frontend is built with React components. A page can call a service directly when rendering on the server; a browser action such as adding an item sends a request to a Next.js API route. API routes validate the request and call services. Services handle the shopping rules and call repository functions, which are responsible for DynamoDB reads and writes.

```text
Browser / Next.js page
        |
        v
Route handler (for browser API requests)
        |
        v
Service (cart, catalogue, accounts, wishlist)
        |
        v
DynamoDB repository
        |
        v
DynamoDB table
```

The main directories reflect that separation:

| Path | Responsibility |
| --- | --- |
| `src/app/` | Pages, loading/error pages and API routes |
| `src/components/` | Reusable interface components |
| `src/services/` | Catalogue, cart, wishlist and account logic |
| `src/db/repositories/` | DynamoDB queries and updates |
| `src/lib/` | Validation, configuration, sessions and shared utilities |
| `src/types/` | Shared TypeScript types |
| `scripts/` | Database setup, sample data and integration checks |
| `tests/` | Vitest unit tests |
| `docs/` | Notes on authentication, cart consistency and local database setup |

For example, clicking **Add to cart** sends a product ID and quantity to `/api/cart`. The service checks whether the product exists and is in stock, then conditionally updates the user's cart record. The response contains the recalculated cart. If another request changed that record in the meantime, the service rereads it and retries rather than silently overwriting an addition.

## DynamoDB data and operations

The application uses one DynamoDB table, `tidewell-store` by default. Each record has a partition key (`PK`) and sort key (`SK`); two secondary indexes support category and catalogue listings.

| Data | Example keys | How it is used |
| --- | --- | --- |
| Product | `PRODUCT#id` / `METADATA` | Product details and stock |
| Category | `CATEGORY#slug` / `METADATA` | Store categories |
| Profile | `USER#id` / `PROFILE` | User name and email |
| Credentials | `USER#acct-id` / `CREDENTIALS` | Salted password hash, never plaintext |
| Email lookup | `AUTH_EMAIL#hash` / `LOOKUP` | Find an account and enforce unique emails |
| Cart item | `USER#id` / `CART#productId` | Quantity and a version for concurrent updates |
| Wishlist item | `USER#id` / `WISHLIST#productId` | One saved record per product |
| Rate-limit counter | `RATE#scope#hash` / `WINDOW#number` | Shared login and registration request counts |

The application reads products with `GetItem`, category/product indexes with `Query`, and groups of product IDs with `BatchGetItem`. Account creation uses a DynamoDB transaction. Cart updates use conditional writes and strongly consistent reads; wishlist additions use a condition to prevent duplicates. Cart totals use current product prices rather than duplicating prices in cart records.

Search and price filtering currently run in the service layer after a DynamoDB query. This is reasonable for the small sample catalogue, but it would need a different approach for a much larger store.

## API

API responses use a `data` field for success or an `error` field for failure. The principal routes are:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/products`, `/api/products/[id]` | List/search products or load a product |
| GET | `/api/categories` | List categories |
| GET, POST | `/api/cart` | Read cart or add a product |
| PATCH, DELETE | `/api/cart/[productId]` | Set a quantity or remove a product |
| GET, POST | `/api/wishlist` | Read or add wishlist items |
| DELETE | `/api/wishlist/[productId]` | Remove a wishlist item |
| GET, PUT | `/api/user` | Read or update the profile |
| POST | `/api/auth/register` | Register an account |
| NextAuth routes | `/api/auth/[...nextauth]` | Sign-in, sessions and sign-out |
| POST | `/api/account/import-guest` | Move eligible guest items into an account |

Requests are validated with Zod. The server derives account ownership from the authenticated session, not from a user ID supplied in the request. Invalid input, missing products, conflicts and database errors are returned with appropriate HTTP errors and user-readable messages.

Registered email addresses cannot be changed through the general profile form; that would also require updating the unique email lookup record.

## Accounts and security

Passwords are hashed with `scrypt` and a random salt. NextAuth manages authenticated sessions, while guest visitors receive an HMAC-signed `tw_uid` cookie. Registration and login attempts have DynamoDB-backed rate limits. See [Authentication](docs/AUTHENTICATION.md), [Request limits](docs/AUTH_RATE_LIMITING.md) and [Guest sessions](docs/GUEST_SESSION_SECURITY.md) for the exact behavior.

This is a local development project, **not a security-hardened public service**. There is no email verification, password reset, account deletion, or multi-factor authentication. Public hosting would need further security work and operational monitoring.

## Run the checks

First run the standard code checks:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm audit
```

The database tests need DynamoDB Local running:

```powershell
npm run db:test-cart
npx tsx scripts/check-auth-rate-limit.ts
```

For the API isolation check, keep both DynamoDB and the Next.js app running in separate terminals:

```powershell
node --env-file=.env.local scripts/check-api-isolation.mjs
```

The integration scripts use temporary test records and clean up after themselves. The API script creates two temporary accounts to check registration, sign-in, cart/wishlist separation and unauthorized requests. It refuses a nonlocal DynamoDB endpoint. Don't reseed an existing database just to run the tests.

## Submission and current limits

The internship assignment asks for a GitHub link, a documented project and **screenshots of the finished application**. A live URL is requested only *if deployed*; local development is sufficient for the documented build and testing work.

Screenshots still need to be added to `docs/screenshots/`: homepage, filtered product list, product detail, cart, wishlist, empty state, not-found page and a mobile-sized view. Replace the unrelated sample photos before taking the final screenshots.

Tidewell does not process payments or place orders, and its cart does not reserve inventory. Docker's persistent volume keeps local data across restarts but is **not a backup**.
