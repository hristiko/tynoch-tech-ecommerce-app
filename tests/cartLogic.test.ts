import { describe, expect, it } from "vitest";
import { buildCart, clampQuantity, mergeQuantity } from "@/services/cartLogic";
import { filterAndSort } from "@/services/catalog";
import { addToCartSchema, profileSchema } from "@/lib/validation";
import type { CartItemRecord, Product } from "@/types";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1", name: "Lamp", description: "A lamp", priceCents: 1000, categorySlug: "desk",
  images: [], stock: 5, rating: 4, tags: ["light"], createdAt: "2026-01-01T00:00:00.000Z", ...over,
});
const item = (productId: string, quantity: number): CartItemRecord => ({ userId: "u", productId, quantity, addedAt: "" });

describe("cart logic", () => {
  it("clamps quantity to stock and per-item max", () => {
    expect(clampQuantity(99, 5)).toBe(5);
    expect(clampQuantity(99, 50)).toBe(10);
    expect(clampQuantity(0, 5)).toBe(1);
  });

  it("does not charge for an item that has gone out of stock", () => {
    expect(clampQuantity(3, 0)).toBe(0);
    const cart = buildCart([item("a", 3)], [product({ id: "a", stock: 0, priceCents: 1299 })]);
    expect(cart.lines).toHaveLength(1); // still visible so the user can remove it
    expect(cart.lines[0].quantity).toBe(0);
    expect(cart.lines[0].lineTotalCents).toBe(0);
    expect(cart.itemCount).toBe(0);
    expect(cart.subtotalCents).toBe(0);
  });

  it("merges duplicate adds into a single quantity", () => {
    expect(mergeQuantity(undefined, 2, 5)).toBe(2);
    expect(mergeQuantity(2, 2, 5)).toBe(4);
    expect(mergeQuantity(4, 4, 5)).toBe(5);
  });

  it("calculates line totals, item count and subtotal in cents", () => {
    const cart = buildCart(
      [item("a", 2), item("b", 1)],
      [product({ id: "a", name: "A", priceCents: 1999 }), product({ id: "b", name: "B", priceCents: 500 })]
    );
    expect(cart.subtotalCents).toBe(1999 * 2 + 500);
    expect(cart.itemCount).toBe(3);
  });

  it("skips products that no longer exist", () => {
    const cart = buildCart([item("gone", 1)], []);
    expect(cart.lines).toHaveLength(0);
    expect(cart.subtotalCents).toBe(0);
  });
});

describe("catalog filtering", () => {
  const list = [
    product({ id: "a", name: "Oak Tray", priceCents: 3000, rating: 4.1 }),
    product({ id: "b", name: "Steel Bottle", priceCents: 1500, rating: 4.9, tags: ["travel"] }),
  ];
  it("searches name and tags", () => {
    expect(filterAndSort(list, { q: "travel" }).map((p) => p.id)).toEqual(["b"]);
  });
  it("filters by price range and sorts", () => {
    expect(filterAndSort(list, { minPriceCents: 2000 }).map((p) => p.id)).toEqual(["a"]);
    expect(filterAndSort(list, { sort: "price-asc" }).map((p) => p.id)).toEqual(["b", "a"]);
    expect(filterAndSort(list, { sort: "rating" })[0].id).toBe("b");
  });
});

describe("validation", () => {
  it("defaults quantity and rejects bad input", () => {
    expect(addToCartSchema.parse({ productId: "abc" }).quantity).toBe(1);
    expect(() => addToCartSchema.parse({ productId: "abc", quantity: 0 })).toThrow();
    expect(() => addToCartSchema.parse({ productId: "bad id!", quantity: 1 })).toThrow();
  });
  it("validates profile", () => {
    expect(profileSchema.parse({ name: "Ana", email: " ANA@Example.com " }).email).toBe("ana@example.com");
    expect(() => profileSchema.parse({ name: "A", email: "nope" })).toThrow();
  });
});
