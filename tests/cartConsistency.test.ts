import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItemRecord, Product } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  compareAndPut: vi.fn(),
  remove: vi.fn(),
  getById: vi.fn(),
  getMany: vi.fn(),
  ensure: vi.fn(),
}));

vi.mock("@/db/repositories/cart", () => ({
  cartRepo: { list: mocks.list, get: mocks.get, compareAndPut: mocks.compareAndPut, remove: mocks.remove },
}));
vi.mock("@/db/repositories/products", () => ({
  productRepo: { getById: mocks.getById, getMany: mocks.getMany },
}));
vi.mock("@/db/repositories/users", () => ({
  userRepo: { ensure: mocks.ensure },
}));

import { cartService } from "@/services/cart";

const product: Product = {
  id: "p1", name: "Desk Lamp", description: "Lamp", priceCents: 2500,
  categorySlug: "desk", images: [], stock: 10, rating: 4,
  tags: [], createdAt: "2026-01-01T00:00:00.000Z",
};
let cartItems: Map<string, CartItemRecord>;

beforeEach(() => {
  vi.clearAllMocks();
  cartItems = new Map();
  mocks.ensure.mockResolvedValue(undefined);
  mocks.getById.mockResolvedValue(product);
  mocks.getMany.mockImplementation(async (ids: string[]) => ids.includes(product.id) ? [product] : []);
  mocks.list.mockImplementation(async () => [...cartItems.values()].map((it) => ({ ...it })));
  mocks.get.mockImplementation(async (_userId: string, id: string) => {
    const previous = cartItems.get(id);
    await Promise.resolve();
    return previous ? { ...previous } : null;
  });
  mocks.compareAndPut.mockImplementation(async (item: CartItemRecord, previous: CartItemRecord | null) => {
    await Promise.resolve();
    const current = cartItems.get(item.productId);
    const matches = !previous
      ? !current
      : !!current && (previous.version === undefined
          ? current.version === undefined && current.quantity === previous.quantity
          : current.version === previous.version);
    if (!matches) return false;
    cartItems.set(item.productId, { ...item, version: (previous?.version ?? 0) + 1 });
    return true;
  });
  mocks.remove.mockImplementation(async (_userId: string, id: string) => {
    cartItems.delete(id);
  });
});

describe("cart concurrent update behavior", () => {
  it("does not lose additions when six requests add the same product concurrently", async () => {
    await Promise.all(Array.from({ length: 6 }, () => cartService.add("user-1", "p1", 1)));
    expect(cartItems.get("p1")?.quantity).toBe(6);
    expect(cartItems.get("p1")?.version).toBe(6);
    expect(mocks.compareAndPut.mock.calls.length).toBeGreaterThan(6);
  });

  it("limits concurrent additions to stock and the per-item maximum", async () => {
    await Promise.all(Array.from({ length: 6 }, () => cartService.add("user-1", "p1", 3)));
    expect(cartItems.get("p1")?.quantity).toBe(10);
    expect((await cartService.get("user-1")).subtotalCents).toBe(25000);
  });

  it("updates existing unversioned cart rows without discarding them", async () => {
    cartItems.set("p1", { userId: "user-1", productId: "p1", quantity: 2, addedAt: "old-time" });
    await cartService.add("user-1", "p1", 1);
    expect(cartItems.get("p1")).toMatchObject({ quantity: 3, addedAt: "old-time", version: 1 });
  });

  it("prevents a quantity update from resurrecting an item removed concurrently", async () => {
    cartItems.set("p1", { userId: "user-1", productId: "p1", quantity: 2, addedAt: "old", version: 1 });
    mocks.compareAndPut.mockImplementationOnce(async () => {
      cartItems.delete("p1");
      return false;
    });
    await expect(cartService.setQuantity("user-1", "p1", 4)).rejects.toMatchObject({ status: 404 });
    expect(cartItems.has("p1")).toBe(false);
  });
});
