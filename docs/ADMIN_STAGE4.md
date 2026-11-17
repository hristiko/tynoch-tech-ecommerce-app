# Tidewell admin — Stage 4: users, carts and wishlists

This stage extends the existing `admin/` application. It reuses the same DynamoDB records as the storefront and does not modify the 300 historical demo orders.

## Functionality

- **Users — `/users`**: searchable, paginated registered-account listing, customer/admin role labels, account details, current cart/wishlist counts, and display-name editing.
- **Account deletion**: delete a *customer* account, including its credential record, hashed-email lookup, cart and wishlist records, in a DynamoDB transaction. Deletion requires the current profile revision and a typed email confirmation. Administrator accounts, the acting administrator, accounts with real storefront orders, and accounts with unexpected linked records are protected.
- **Carts — `/carts`**: inspect registered and guest cart lines, quantities, current product prices, estimated subtotals, and stock availability. Remove an individual cart item with confirmation and concurrency checks.
- **Wishlists — `/wishlists`**: inspect registered and guest saved products. Remove an individual wishlist record with confirmation and an update check.
- Text search, account-type filters, eight-row pagination, empty/error states, manual refresh, and automatic refresh approximately every 15 seconds.
- All routes check an active admin session and confirm the current DynamoDB admin role. Mutations require a same-origin JSON request; only the display name is editable. Password hashes, registration credentials, and email lookup records are never exposed in the API response.

The account email is deliberately **read-only** because the login lookup uses a hash of the email. A future email-change workflow must update both the profile and login lookup transactionally and verify the new address. Admin role assignment remains a local CLI operation, not a web form.

## Install (Windows PowerShell)

From the repository root, confirm that Stage 3 is already installed and that no unintended changes will be overwritten:

```powershell
# From e-commerce-app/admin
cd ..
git status --short
```

Stop the admin server with Ctrl+C. Keep Docker Desktop and the existing DynamoDB Local container running. Place `tidewell-admin-stage4.zip` in the **repository root**, then run:

```powershell
# From e-commerce-app
Expand-Archive -Path ".\tidewell-admin-stage4.zip" -DestinationPath "." -Force
```

The package merges new code under `admin/`, updates admin navigation/test commands and adds this guide. It does not contain `.env.local`, a seed script, a database backup, or any change to your account credentials.

**Before using customer deletion**, apply the included storefront safety patch. It prevents a deleted account's previously issued customer JWT from being treated as an existing account, and prevents the storefront's `ensure()` helper from recreating deleted `acct-...` records:

```powershell
git apply --check storefront-account-delete-guard.patch
git apply storefront-account-delete-guard.patch
```

If `git apply --check` fails, **do not delete customer accounts**. Send the error output so the patch can be reconciled with your local storefront changes. Do not force the patch or reset your project.

The patch changes only these existing storefront files:

- `src/lib/session.ts` — verify an authenticated account still has a profile.
- `src/db/repositories/users.ts` — existing registered account IDs must never be auto-created by guest-style `ensure()` logic.
- `src/app/api/account/import-guest/route.ts` — reject import requests from deleted account sessions.

No existing database records are changed by extraction or patch application.

## Run checks

From `e-commerce-app/admin`:

```powershell
cd admin
npm run typecheck
npm test
npm run lint
npm run build
```

The unit tests now cover admin authorization, password compatibility, synthetic sales, catalogue rules, customer input validation, protected account deletion, cart revision checks and grouping registered/guest shopping data.

With DynamoDB Local running:

```powershell
npm run db:test-customers
```

This **local-only** test creates temporary registered and guest records using random IDs. It verifies listing, profile edits, conflict handling, shopping inspection, cart/wishlist removal and transactional account deletion, then removes its temporary records. It does not modify existing customers or the sample catalogue. It will refuse to use a non-local DynamoDB endpoint.

Start the admin app:

```powershell
npm run dev
```

Open:

- `http://localhost:3001/users`
- `http://localhost:3001/carts`
- `http://localhost:3001/wishlists`

In a second admin terminal, test anonymous access:

```powershell
npm run check:unauthorized
```

Each admin endpoint should respond with HTTP `401` for unauthenticated requests.

### Verify storefront synchronization

1. Keep the storefront running at `http://localhost:3000` and the admin running at `http://localhost:3001`.
2. Sign into the storefront using a **normal customer account**, not your administrator account.
3. Change the account display name through the admin Users page. Refresh the storefront account page: the new name should appear.
4. Add a product to the customer's cart or wishlist through the storefront. Open the matching admin Carts or Wishlists page; after refresh or its polling interval, the change should appear.
5. Remove the item using the admin page (confirm the action), then refresh the storefront and verify it disappeared.
6. For account deletion tests, use `npm run db:test-customers` rather than deleting your existing test accounts.

## API endpoints

| Method | Route | Operation |
| --- | --- | --- |
| GET | `/api/admin/users` | List registered accounts (safe fields only) |
| GET | `/api/admin/users/[id]` | Account and shopping details |
| PUT | `/api/admin/users/[id]` | Update display name with revision check |
| DELETE | `/api/admin/users/[id]` | Delete a customer and related records (confirmed; administrators blocked) |
| GET | `/api/admin/shopping` | List shopper activity, including guests |
| GET | `/api/admin/shopping/[id]` | Inspect a user's cart and wishlist |
| DELETE | `/api/admin/shopping/[id]/[kind]/[productId]` | Remove one cart/wishlist item safely |

## Data and safety notes

- Registered users are `USER#acct-...` profile records with `accountType=registered`. Guest shoppers may have `USER#guest-...` profile/cart/wishlist records. The Users page lists registered accounts; Carts and Wishlists include both registered and guest shopping activity.
- Customer name changes modify only `name` and `updatedAt`; the role, email, registration date and login credentials are preserved.
- Account deletion is permanent and requires two confirmations. It is transactional (up to DynamoDB's 100-item transaction limit). It removes credentials, profile, unique email lookup and all captured cart/wishlist records together. It does not delete historical demo orders or adjust product stock.
- The server refuses deletion of an administrator, the current admin's account, an account with known real storefront orders, accounts with unexpected linked keys, and accounts whose profile changed since the screen was loaded.
- Cart and wishlist removals are conditional: if a customer changes the record after it was displayed, the admin receives a conflict and must refresh.
- The customer storefront's saved JWT may remain in the browser until it expires, but the patch above prevents that token from authorizing access to a deleted account's data. Account deletion does not forcibly clear cookies in another browser.
- The account-deletion transaction cannot absolutely prevent a separately running client from writing new records in the narrow interval between a pre-write check and deletion. This is a learning project; a production implementation should use account-state tombstones and a shared transactional write guard or explicit revocation store.
- Admin lists scan the small DynamoDB demo table. This is appropriate for a small assignment but not a large-production user database; scalable deployments need indexes and paginated cursor-based queries.
- Removing a product from someone's cart does **not** count as a sale. Shopping counts and details reflect the latest committed DynamoDB data. Sales statistics continue to come from order records.

## Files added or updated

- `admin/src/lib/customer-model.ts`, `customer-db.ts`, `customer-api.ts`
- `admin/src/app/api/admin/users/*`, `admin/src/app/api/admin/shopping/*`
- `admin/src/app/users/page.tsx`, `carts/page.tsx`, `wishlists/page.tsx`
- `admin/src/components/UsersManager.tsx`, `ShoppingManager.tsx`, updated `AdminShell.tsx`
- `admin/tests/customers.test.ts`, `admin/scripts/check-users-shopping.ts`
- Updated `admin/scripts/check-unauthorized.mjs` and `admin/package.json`
- `storefront-account-delete-guard.patch`

After all local tests pass, review `git status` and `git diff` before committing only the intended files to `main`. Do not commit the ZIP, `.env.local`, test data or credentials.
