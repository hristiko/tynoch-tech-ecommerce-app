import type { Metadata } from "next";
import CartList from "@/components/CartList";
import { cartService } from "@/services/cart";
import { getViewerUserId } from "@/lib/session";
import type { Cart } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const userId = await getViewerUserId();
  const cart: Cart = userId ? await cartService.get(userId) : { lines: [], itemCount: 0, subtotalCents: 0 };
  return (
    <div>
      <h1 className="mb-8 text-4xl font-extrabold">Your cart</h1>
      <CartList initial={cart} />
    </div>
  );
}
