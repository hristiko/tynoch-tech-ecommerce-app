# Tidewell admin — Stage 1

This addition is a separate Next.js application in `admin/`. It shares the existing DynamoDB table with the customer storefront, but uses its own NextAuth configuration, cookies, login page, and server-side admin role check.

## Before you begin

- Keep the existing customer app on port **3000** and the existing DynamoDB Local container on port **8000**.
- **Do not reset or reseed your existing database.**
- Administrator access must be granted from the command line; there is no public admin signup endpoint.

## Local setup (PowerShell)

From the repository root:

```powershell
cd admin
npm install
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Paste that random value into `NEXTAUTH_SECRET` in `admin/.env.local`. The admin secret **must differ from** the storefront secret. The rest of the values should point to your existing local database (table `tidewell-store`, endpoint `http://localhost:8000`).

Start the admin app:

```powershell
npm run dev
```

Open **http://localhost:3001/login**. It will reject all accounts until an administrator role is explicitly assigned.

## Grant the first administrator

First create a normal account through the storefront at `http://localhost:3000/account` (if you do not already have one). Then open a **second terminal** at the repository root and run:

```powershell
node --env-file=.env.local admin/scripts/grant-admin.mjs
```

This command reads the **storefront's existing `.env.local`**. It prompts for an account email and asks you to type `GRANT`. It updates only that registered account's `role` and `updatedAt` fields in DynamoDB. It does not change the password, carts, or wishlists.

Use the same email and password to sign in at `http://localhost:3001/login`.

## Checks

1. While signed out, visit `http://localhost:3001/`. You should be redirected to `/login`.
2. From the admin directory, run `npm run check:unauthorized`. The protected API must return **401** without a session.
3. Try logging in with a registered **customer account that has not been promoted**. Access must be denied.
4. Sign in with the promoted administrator. You should see registered users, products, categories, cart lines and wishlist entries.
5. In the storefront, add an item to the cart or wishlist, or register a new account. The corresponding dashboard count should update within 15 seconds while the tab is visible (or after clicking **Refresh now**).
6. Run `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` inside `admin/`.
7. Run the existing storefront checks from the repository root (`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`).

## Data and security notes

- Admin accounts are ordinary registered accounts whose DynamoDB `USER#...` / `PROFILE` record has `role: "admin"`.
- Customer registration never sets that field. Customer profile editing accepts only `name` and `email` and does not allow changing the role.
- The admin site's login checks both the password and the **current role** in DynamoDB; every protected admin API request also checks the current role. A customer JWT alone never grants admin access.
- The admin uses separate cookie names and a separate `NEXTAUTH_SECRET`, so its login is not shared with the storefront, including during localhost development on ports 3000 and 3001.
- Logins are limited to eight attempts per email per 15-minute window. Lockouts are deliberately generic to avoid exposing account existence.
- Counts are calculated from DynamoDB records, not hardcoded. `cartItems` and `wishlistItems` count stored cart/wishlist **lines**, not quantities, purchases, or revenue.
- The overview currently uses a paginated, strongly consistent `Scan` because the sample database is small. Before a large production dataset, replace this with purpose-built indexes, counters, or analytics processing.
- AWS DynamoDB `expiresAt` attributes from rate-limit records require TTL enabled separately for automatic cleanup; they do not affect the dashboard metrics.
- The admin app is intentionally not deployed yet; live hosting and synthetic historical sales are later stages.

## Development structure

```text
customer Next.js app (repository root, localhost:3000)
                                  |
                                  v
                       DynamoDB Local :8000
                                  ^
                                  |
admin Next.js app (admin/, localhost:3001)
   - credentials login
   - role check
   - protected overview API
   - auto-refreshing stats
```

The admin site has its own `package.json` and lockfile. Running `npm install` inside `admin/` generates `admin/package-lock.json` and installs its dependencies. Commit the lockfile with the admin code so subsequent installations can use `npm ci`.

## Next stage

Add product and category management. The historical demo-order schema and revenue charts will follow, without modifying the existing checkout behavior or falsifying real sales.
