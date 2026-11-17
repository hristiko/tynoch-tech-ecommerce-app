import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoOrders, type ProductSnapshot } from "../src/lib/demo-orders";
import { isOrderRecord, recentMonths, summarizeSales, type OrderRecord } from "../src/lib/sales-model";

const now = new Date("2026-11-17T10:30:00.000Z");
const products: ProductSnapshot[] = [
  { id: "desk-lamp", name: "Desk Lamp", categorySlug: "desk", priceCents: 8900 },
  { id: "notebook", name: "Notebook", categorySlug: "desk", priceCents: 2200 },
  { id: "bottle", name: "Steel Bottle", categorySlug: "carry", priceCents: 3200 },
];

const sampleOrder = (overrides: Partial<OrderRecord> = {}): OrderRecord => ({
  id: "store-1",
  source: "storefront",
  status: "completed",
  customerId: "customer-1",
  customerName: "Customer",
  currency: "EUR",
  items: [{ productId: "desk-lamp", name: "Desk Lamp", categorySlug: "desk", unitPriceCents: 8900, quantity: 2, lineTotalCents: 17800 }],
  totalCents: 17800,
  createdAt: "2026-11-05T12:00:00.000Z",
  updatedAt: "2026-11-05T12:00:00.000Z",
  ...overrides,
});

describe("demo sales generation", () => {
  it("creates 300 deterministic synthetic orders without future timestamps", () => {
    const generated = createDemoOrders(products, now);
    assert.equal(generated.length, 300);
    assert.deepEqual(generated, createDemoOrders([...products].reverse(), now));
    assert.equal(new Set(generated.map(item => item.id)).size, 300);
    assert.ok(generated.every(item => item.source === "demo" && item.customerId.startsWith("demo-") && isOrderRecord(item)));
    assert.ok(generated.every(item => new Date(item.createdAt).getTime() <= now.getTime()));
    assert.ok(generated.every(item => item.items.length > 0 && item.totalCents > 0));
    assert.deepEqual([...new Set(generated.map(item => item.createdAt.slice(0, 7)))].sort(), [
      "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
    ]);
  });

  it("requires at least one valid existing product", () => {
    assert.throws(() => createDemoOrders([], now), /No valid products/);
  });
});

describe("sales aggregation", () => {
  it("only recognizes completed orders as revenue and uses historical snapshots", () => {
    const completed = sampleOrder();
    const pending = sampleOrder({ id: "store-2", status: "pending", totalCents: 17800 });
    const cancelled = sampleOrder({ id: "demo-3", source: "demo", status: "cancelled" });
    const result = summarizeSales([completed, pending, cancelled], "all", now);
    assert.equal(result.orderCount, 3);
    assert.equal(result.completedCount, 1);
    assert.equal(result.pendingCount, 1);
    assert.equal(result.cancelledCount, 1);
    assert.equal(result.revenueCents, 17800);
    assert.equal(result.averageOrderValueCents, 17800);
    assert.equal(result.sourceTotals.demo, 1);
    assert.equal(result.sourceTotals.storefront, 2);
    assert.equal(result.monthly[5].revenueCents, 17800);
    assert.deepEqual(result.topProducts.map(item => [item.name, item.quantity]), [["Desk Lamp", 2]]);
  });

  it("filters demo and storefront orders independently", () => {
    const records = [sampleOrder(), sampleOrder({ id: "demo-2", source: "demo" })];
    const demo = summarizeSales(records, "demo", now);
    const storefront = summarizeSales(records, "storefront", now);
    assert.equal(demo.orderCount, 1);
    assert.equal(storefront.orderCount, 1);
    assert.equal(demo.recentOrders[0].source, "demo");
    assert.equal(storefront.recentOrders[0].source, "storefront");
    assert.deepEqual(demo.sourceTotals, { demo: 1, storefront: 1 });
  });

  it("ignores invalid records and handles empty data", () => {
    const malformed = { ...sampleOrder(), totalCents: 1 };
    assert.equal(isOrderRecord(malformed), false);
    const result = summarizeSales([malformed], "all", now);
    assert.equal(result.revenueCents, 0);
    assert.equal(result.orderCount, 0);
    assert.equal(result.recentOrders.length, 0);
    assert.equal(result.monthly.length, 6);
  });

  it("crosses year boundaries when generating chart months", () => {
    assert.deepEqual(recentMonths(new Date("2027-02-01T10:00:00Z")).map(item => item.month), [
      "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02",
    ]);
  });
});
