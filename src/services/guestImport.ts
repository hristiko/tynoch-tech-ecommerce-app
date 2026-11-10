import { cartRepo } from "@/db/repositories/cart";
import { productRepo } from "@/db/repositories/products";
import { wishlistRepo } from "@/db/repositories/wishlist";
import { clampQuantity } from "./cartLogic";

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
    if (!product || product.stock <= 0) continue;
    const inserted = await cartRepo.compareAndPut(
      { ...item, userId: accountId, quantity: clampQuantity(item.quantity, product.stock) },
      null
    );
    if (inserted) cartMoved += 1;
    await cartRepo.removeIfUnchanged(item);
  }

  for (const item of wishlistItems) {
    if (!(await productRepo.getById(item.productId))) continue;
    if (await wishlistRepo.add(accountId, item.productId)) wishlistMoved += 1;
    await wishlistRepo.remove(guestId, item.productId);
  }
  return { cartItems: cartMoved, wishlistItems: wishlistMoved };
}
