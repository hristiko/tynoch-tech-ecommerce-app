import { monthKey, type OrderLineSnapshot, type OrderRecord } from "./sales-model";

export const DEMO_ORDER_SEED = "TIDEWELL_DEMO_ORDERS_V1";
export const DEMO_ORDER_COUNTS = [28, 38, 45, 53, 64, 72] as const;

export interface ProductSnapshot {
  id: string;
  name: string;
  categorySlug: string;
  priceCents: number;
}

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomInt(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

export function createDemoOrders(productsInput: ProductSnapshot[], now: Date): OrderRecord[] {
  const products = [...productsInput]
    .filter(product =>
      typeof product.id === "string" && product.id.length > 0 &&
      typeof product.name === "string" && product.name.length > 0 &&
      typeof product.categorySlug === "string" &&
      Number.isSafeInteger(product.priceCents) && product.priceCents > 0
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (products.length === 0) throw new Error("No valid products found in the existing catalogue.");
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid seed date.");

  const monthAnchor = Number(monthKey(now).replace("-", ""));
  const next = randomGenerator(0x7A23BA11 ^ monthAnchor);
  const orders: OrderRecord[] = [];

  for (let i = 0; i < DEMO_ORDER_COUNTS.length; i++) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const month = monthKey(monthStart);
    const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const maxDay = i === 5 ? Math.max(1, now.getUTCDate()) : lastDay;

    for (let j = 0; j < DEMO_ORDER_COUNTS[i]; j++) {
      const chosen = new Set<string>();
      const lines: OrderLineSnapshot[] = [];
      const lineCount = Math.min(products.length, randomInt(next, 1, 4));
      while (lines.length < lineCount) {
        const product = products[randomInt(next, 0, products.length - 1)];
        if (chosen.has(product.id)) continue;
        chosen.add(product.id);
        const quantity = randomInt(next, 1, 3);
        lines.push({
          productId: product.id,
          name: product.name,
          categorySlug: product.categorySlug,
          unitPriceCents: product.priceCents,
          quantity,
          lineTotalCents: product.priceCents * quantity,
        });
      }

      const day = randomInt(next, 1, maxDay);
      const currentDay = i === 5 && day === now.getUTCDate();
      const hour = randomInt(next, 0, currentDay ? now.getUTCHours() : 23);
      const minute = randomInt(next, 0, currentDay && hour === now.getUTCHours() ? now.getUTCMinutes() : 59);
      const createdAt = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day, hour, minute)).toISOString();
      const statusNumber = next();
      const status: OrderRecord["status"] = statusNumber < 0.78 ? "completed" : statusNumber < 0.92 ? "pending" : "cancelled";
      const customerNumber = randomInt(next, 1, 42);
      const id = `demo-v1-${month}-${String(j + 1).padStart(3, "0")}`;
      orders.push({
        id,
        source: "demo",
        status,
        customerId: `demo-customer-${String(customerNumber).padStart(3, "0")}`,
        customerName: `Demo customer ${String(customerNumber).padStart(2, "0")}`,
        currency: "EUR",
        items: lines,
        totalCents: lines.reduce((sum, item) => sum + item.lineTotalCents, 0),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  return orders;
}
