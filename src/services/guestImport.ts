import { cartRepo } from "@/db/repositories/cart";
import { productRepo } from "@/db/repositories/products";
import { wishlistRepo } from "@/db/repositories/wishlist";
import { clampQuantity } from "./cartLogic";

/**
 * Idempotent import: saved account cart quantities take precedence when a product
 * occurs in both carts. Guest-only products and wishlist entries are moved.
 * Remove a guest item only after the destination write succeeds.
 */
export async function importGuestData(guestId: string, accountId: string) {
  if (guestId === accountId) return { cartItems: 0, wishlistItems: 0 };
  const [cartItems, wishlistItems] = await Promise.all([
    cartRepo.list(guestId),
    wishlistRepo.list(guestId),
  ]);
  let cartMoved = 0;
  let wishlistMoved = 0;

  for (const item of cartItems) {
    const product = await productRepo.getById(item.productId);
    if (!product || product.stock <= 0) continue; // Keep unavailable items in guest cart.
    const current = await cartRepo.get(accountId, item.productId);
    if (!current) {
      await cartRepo.upsert({ ...item, userId: accountId, quantity: clampQuantity(item.quantity, product.stock) });
      cartMoved += 1;
    }
    await cartRepo.remove(guestId, item.productId);
  }

  for (const item of wishlistItems) {
    if (!(await productRepo.getById(item.productId))) continue;
    if (await wishlistRepo.add(accountId, item.productId)) wishlistMoved += 1;
    await wishlistRepo.remove(guestId, item.productId);
  }
  return { cartItems: cartMoved, wishlistItems: wishlistMoved };
}
