import { getViewerUserId } from "@/lib/session";
import { cartService } from "./cart";
import { wishlistService } from "./wishlist";

export async function getViewerCartCount(): Promise<number> {
  const id = await getViewerUserId();
  if (!id) return 0;
  try { return await cartService.count(id); } catch { return 0; }
}

export async function getViewerWishlistIds(): Promise<Set<string>> {
  const id = await getViewerUserId();
  if (!id) return new Set();
  try { return new Set(await wishlistService.getIds(id)); } catch { return new Set(); }
}
