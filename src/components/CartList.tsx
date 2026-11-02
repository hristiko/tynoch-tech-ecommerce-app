"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { formatPrice } from "@/lib/utils";
import { MAX_QTY_PER_ITEM } from "@/lib/validation";
import type { Cart } from "@/types";

export default function CartList({ initial }: { initial: Cart }) {
  const [cart, setCart] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function run(productId: string, request: () => Promise<Cart>) {
    setBusyId(productId);
    setError(null);
    try {
      setCart(await request());
      startTransition(() => router.refresh()); // keeps header badge in sync
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const setQty = (id: string, quantity: number) =>
    run(id, () => api<Cart>(`/api/cart/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) }));
  const remove = (id: string) => run(id, () => api<Cart>(`/api/cart/${id}`, { method: "DELETE" }));

  if (cart.lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink/25 px-6 py-16 text-center">
        <h2 className="text-xl font-semibold">Your cart is empty</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">Add something from the shop and it will show up here.</p>
        <Link href="/products" className="btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {cart.lines.map(({ product, quantity, lineTotalCents }) => {
            const max = Math.min(product.stock, MAX_QTY_PER_ITEM);
            const busy = busyId === product.id;
            return (
              <li key={product.id} className={`flex gap-4 py-5 ${busy ? "opacity-60" : ""}`}>
                <Link href={`/products/${product.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-sand/50">
                  <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between sm:flex-row">
                  <div>
                    <Link href={`/products/${product.id}`} className="font-semibold hover:text-cobalt">{product.name}</Link>
                    <p className="text-sm text-muted">{formatPrice(product.priceCents)} each</p>
                    <button type="button" onClick={() => remove(product.id)} disabled={busy} className="mt-2 text-sm font-medium text-cobalt hover:underline disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-4 sm:mt-0 sm:flex-col sm:items-end sm:gap-2">
                    <div className="flex items-center rounded-md border border-ink/25 bg-white">
                      <button type="button" aria-label={`Decrease quantity of ${product.name}`} onClick={() => setQty(product.id, quantity - 1)} disabled={busy || quantity <= 1} className="px-3 py-1.5 disabled:opacity-40">−</button>
                      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{quantity}</span>
                      <button type="button" aria-label={`Increase quantity of ${product.name}`} onClick={() => setQty(product.id, quantity + 1)} disabled={busy || quantity >= max} className="px-3 py-1.5 disabled:opacity-40">+</button>
                    </div>
                    <p className="font-semibold tabular-nums">{formatPrice(lineTotalCents)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="h-fit rounded-lg border border-ink/10 bg-white p-5" aria-label="Order summary">
        <h2 className="text-lg font-semibold">Summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="tabular-nums">{cart.itemCount}</dd></div>
          <div className="flex justify-between border-t border-ink/10 pt-3 text-base font-semibold"><dt>Subtotal</dt><dd className="tabular-nums">{formatPrice(cart.subtotalCents)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">Shipping and taxes are calculated at checkout.</p>
        <button type="button" disabled className="btn-primary mt-5 w-full" title="Checkout is outside the scope of this project">Checkout (coming soon)</button>
      </aside>
    </div>
  );
}
