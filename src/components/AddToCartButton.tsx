"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { MAX_QTY_PER_ITEM } from "@/lib/validation";

interface Props { productId: string; stock: number; showQuantity?: boolean }

export default function AddToCartButton({ productId, stock, showQuantity = false }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "added">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const max = Math.min(stock, MAX_QTY_PER_ITEM);

  if (stock < 1) {
    return <button type="button" disabled className="btn-primary w-full">Out of stock</button>;
  }

  async function add() {
    setStatus("loading");
    setError(null);
    try {
      await api("/api/cart", { method: "POST", body: JSON.stringify({ productId, quantity }) });
      setStatus("added");
      startTransition(() => router.refresh());
      setTimeout(() => setStatus("idle"), 1800);
    } catch (e) {
      setStatus("idle");
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex gap-3">
        {showQuantity && (
          <div>
            <label htmlFor={`qty-${productId}`} className="sr-only">Quantity</label>
            <select id={`qty-${productId}`} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="field w-20">
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        )}
        <button type="button" onClick={add} disabled={status === "loading"} className="btn-primary flex-1">
          {status === "loading" ? "Adding…" : status === "added" ? "Added to cart" : "Add to cart"}
        </button>
      </div>
      <p role="status" className="sr-only">{status === "added" ? "Item added to your cart" : ""}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
