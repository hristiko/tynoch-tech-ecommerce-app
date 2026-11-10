import { MAX_QTY_PER_ITEM } from "@/lib/validation";
import type { Cart, CartItemRecord, CartLine, Product } from "@/types";


export function clampQuantity(requested: number, stock: number): number {
  if (stock <= 0) return 0;
  return Math.max(1, Math.min(requested, MAX_QTY_PER_ITEM, stock));
}

export function mergeQuantity(existing: number | undefined, toAdd: number, stock: number): number {
  return clampQuantity((existing ?? 0) + toAdd, stock);
}

export function buildCart(items: CartItemRecord[], products: Product[]): Cart {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: CartLine[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) continue;
    const quantity = clampQuantity(item.quantity, product.stock);
    lines.push({ product, quantity, lineTotalCents: product.priceCents * quantity });
  }
  lines.sort((a, b) => a.product.name.localeCompare(b.product.name));
  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: lines.reduce((sum, l) => sum + l.lineTotalCents, 0),
  };
}
