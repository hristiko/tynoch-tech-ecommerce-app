import { cartService } from "@/services/cart";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateUserId, getUserId } from "@/lib/session";
import { addToCartSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const empty = { lines: [], itemCount: 0, subtotalCents: 0 };

export const GET = handle(async () => {
  const userId = getUserId();
  return ok(userId ? await cartService.get(userId) : empty);
});

export const POST = handle(async (req: Request) => {
  const { productId, quantity } = addToCartSchema.parse(await readJson(req));
  return ok(await cartService.add(getOrCreateUserId(), productId, quantity), 201);
});
