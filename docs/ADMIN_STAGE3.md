# Tidewell admin — Stage 3: product and category management

Stage 3 extends the existing `admin/` Next.js application from Stages 1–2. It adds real CRUD operations for the **same** product and category records used by the storefront. It does not replace the storefront or its database.

## What is included

- `http://localhost:3001/products`: product listing with text search, category/stock filters, eight-row pagination, add/edit/delete forms, stock and price editing, and empty/error/loading feedback.
- `http://localhost:3001/categories`: category list, search, add/edit/delete forms and current product counts.
- Admin-only HTTP APIs:

  | Method | Endpoint | Purpose |
  | --- | --- | --- |
  | GET / POST | `/api/admin/products` | List / create products |
  | PUT / DELETE | `/api/admin/products/[id]` | Update / delete a product |
  | GET / POST | `/api/admin/categories` | List / create categories |
  | PUT / DELETE | `/api/admin/categories/[slug]` | Update / delete a category |

- Every endpoint checks the signed-in session and current admin role in DynamoDB. Mutating endpoints also check the request origin, JSON type, request size and field values.
- Optimistic-concurrency revision checks prevent old edit forms from overwriting another administrator's changes. Pre-existing catalogue items have no revision field; the first successful edit adds one.
- Product deletions are rejected while the product appears in any cart or wishlist. Category deletions are rejected while products belong to the category.
- Storefront-compatible DynamoDB keys and secondary-index attributes are preserved: product `PK=PRODUCT#id`, category `PK=CATEGORY#slug`, `GSI1` by category, and `GSI2` by record type.
- New item IDs and category slugs are permanent. Names, descriptions, stock, prices, ratings, images and product category assignments can be edited.

## Install (Windows PowerShell)

Keep Docker Desktop running. Stop the admin dev server using Ctrl+C before installing.

Place `tidewell-admin-stage3.zip` in the **repository root** (`e-commerce-app`), then run **from `e-commerce-app/admin`**:

```powershell
Expand-Archive -Path "..\tidewell-admin-stage3.zip" -DestinationPath ".." -Force
npm run typecheck
npm test
npm run lint
npm run build
```

Stage 3 only updates files under `admin/` and adds this document. It does not overwrite `.env.local`, your corrected grant-admin script, database records or storefront code. Do not reset the database or rerun the catalogue or sales seed commands.

## Local integration test

With DynamoDB Local running:

```powershell
npm run db:test-catalog
```

The test creates temporary category/product records with random IDs, checks create/edit/conflict/deletion rules, and cleans up its temporary data. It is deliberately limited to `http://localhost:8000` or `http://127.0.0.1:8000` and refuses cloud endpoints.

Start the admin app:

```powershell
npm run dev
```

Open `http://localhost:3001`, sign in with the existing admin account, and use **Products** or **Categories** from the navigation. Both pages read the actual DynamoDB table.

With the admin app running, use another terminal to check that unauthenticated visitors cannot access the new admin endpoints:

```powershell
npm run check:unauthorized
```

## Verify storefront synchronization

1. Run the storefront in a separate terminal from the repository root: `npm run dev` (port 3000).
2. In the admin, open **Products**, choose an existing product, and change its stock by one unit. Save.
3. Refresh that product's page on the storefront at port 3000. The stock status must reflect the new quantity. Price and description changes are also shared.
4. Restore the original stock if this was just a test.
5. In **Categories**, change a category's description and refresh the storefront home page. The updated description should appear.
6. For deletion tests, use `npm run db:test-catalog`; do not delete existing catalogue records just to test deletion.

Pages and management tables refresh from the database; they are not a continuous WebSocket feed. The admin tables poll every 15 seconds while not being edited. Storefront product/category listings use DynamoDB secondary indexes, so a newly added or reassigned record may need a brief delay before it appears after refresh.

## Image paths

This stage stores image paths; it does **not** upload images. A new product image must already be present under the storefront's `public/images/products/` directory, and a category image under `public/images/categories/`. Valid values look like:

```text
/images/products/arc-desk-lamp.jpg
/images/categories/desk.jpg
```

For initial testing, existing image paths may be reused. If a new image path points to a missing file, the storefront will display a broken image until you supply that asset. A future image-upload interface can be added separately, especially when the storefront is deployed.

## Data integrity notes

- Updating prices and products does **not** rewrite the 300 synthetic historical orders. Those contain purchase-time product snapshots, so historical revenue remains consistent.
- Changing a category's slug or a product's ID is not supported because other records use those identifiers.
- Category changes update the product's `GSI1PK` category index so storefront filtering continues to work.
- A product cannot be deleted while referenced by carts or wishlists. An empty category can be deleted.
- The reference checks and list operations scan the small demonstration table with consistent reads. For a larger deployed store, use a dedicated product/category index and transactional reference tracking; the scan-then-delete protection is not strictly atomic under simultaneous new cart additions. Avoid heavy concurrent delete activity until this is implemented.
- Only product/category data is managed in this stage. User management and cart/wishlist inspection follow in Stage 4.

## Files changed by Stage 3

- `admin/package.json` — new test and local integration-check commands.
- `admin/scripts/check-unauthorized.mjs` — additional protected endpoints.
- `admin/scripts/check-catalog-crud.ts` — integration check.
- `admin/src/app/page.tsx` — dashboard navigation.
- `admin/src/app/products/page.tsx`, `admin/src/app/categories/page.tsx` — management pages.
- `admin/src/app/api/admin/products/...`, `admin/src/app/api/admin/categories/...` — protected CRUD API routes.
- `admin/src/components/AdminShell.tsx`, `ProductsManager.tsx`, `CategoriesManager.tsx`, `catalog-ui.ts` — admin interface.
- `admin/src/lib/catalog-model.ts`, `catalog-db.ts`, `admin-api.ts` — data validation, database operations, authorization.
- `admin/tests/catalog.test.ts` — validation and data-integrity unit tests.
