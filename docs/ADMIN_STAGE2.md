# Tidewell admin - Stage 2: demo orders and sales analytics

This stage extends the working `admin/` application from Stage 1. It adds synthetic order records and sales analytics. It does not implement storefront checkout, and it does not create real purchases.

## What changes

- A new order record uses `PK: ORDER#<id>`, `SK: METADATA`, `GSI2PK: TYPE#ORDER`, `GSI2SK: <createdAt>#<id>`. It shares the existing DynamoDB table and its already-created `GSI2` index; **no table migration** is necessary.
- Each order stores its source (`demo` or `storefront`), status (`completed`, `pending`, `cancelled`), historical product names, prices, quantities, order total in integer cents, customer label, currency (EUR), and timestamp.
- Synthetic orders use `source: demo` and `demo-customer-*` IDs that do **not** correspond to registered user accounts. The actual user count remains unchanged.
- A protected admin sales API at `GET /api/admin/sales?source=all|demo|storefront` computes revenue, status counts, six-month revenue, best-selling products, and recent orders.
- The dashboard labels demo data visibly and supports a source filter. Existing customer/cart/wishlist figures continue to come directly from the same database.

## Safe installation (PowerShell)

1. Keep Docker Desktop and the existing `tidewell-dynamodb` container running.
2. Extract `tidewell-admin-stage2.zip` into your existing `e-commerce-app` repository root, choosing **merge/overwrite** for the few files already present in `admin/`. Do not delete or replace the full `admin/` directory. Keep your `admin/.env.local` intact.
3. In the admin directory, run checks:

```powershell
cd admin
npm run typecheck
npm test
npm run lint
npm run build
```

4. Preview the generated dataset without writing to the database:

```powershell
npm run db:seed-sales
```

5. If the preview looks correct, insert the orders:

```powershell
npm run db:seed-sales -- --apply
```

The script generates 300 demo orders across the latest six calendar months. The distribution is intentionally illustrative rather than based on historical sales. It uses existing product names and prices as **snapshots**, but never changes the products, stock, registered accounts, carts, or wishlists. Pending and cancelled orders are excluded from revenue.

The seeding operation is idempotent. A `SEED#TIDEWELL_DEMO_ORDERS_V1` marker prevents adding another 300 orders accidentally on a later run; individual conditional writes also prevent duplicate order IDs. If the operation is interrupted, rerun the same `--apply` command to finish. Do not delete the marker manually to generate more sales.

**Safety:** The script rejects non-local DynamoDB unless deliberately invoked with both `--allow-cloud` and the environment variable `CONFIRM_CLOUD_DEMO_SEED=YES`. Do not use cloud seeding until the production database and access permissions have been separately configured and reviewed.

## Verify

Run `npm run dev` in `admin/` and open `http://localhost:3001` with your existing administrator credentials. The overview should now show:

- Sales KPI cards (completed-order revenue, orders, completed orders, average order value)
- Revenue chart over the past six calendar months
- Status distribution chart, best-selling products, and eight newest orders
- A source filter: All / Demo / Storefront
- The original counts of users, products, categories, cart lines, and wishlist lines

Switch to **Storefront orders only**. The order count and revenue should both be zero because the current storefront has no checkout/order-creation functionality. Changes to its cart or wishlist will still update the existing activity counters, not sales revenue.

Run `npm run check:unauthorized` and check that unauthenticated API access remains blocked. The sales endpoint additionally checks current DynamoDB admin role on every request.

## For later deployment

There is no simulated order-creation API exposed to users. A future checkout/order workflow can create real records with `source: storefront`. The admin will then include them in analytics while allowing demo records to be filtered out. Cloud database seeding and the deployment of separate storefront/admin sites are later stages.

The sales API currently reads all orders from the existing `GSI2` index with pagination; this is acceptable for the small internship dataset. For a large store, use bounded date queries or precomputed aggregates rather than reading every order on each dashboard refresh.
