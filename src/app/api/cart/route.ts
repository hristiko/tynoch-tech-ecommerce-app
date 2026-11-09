import { requireSameOrigin } from "@/lib/origin";
import { cartService } from "@/services/cart";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateViewerUserId, getViewerUserId } from "@/lib/session";
import { addToCartSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const empty = { lines: [], itemCount: 0, subtotalCents: 0 };

export const GET = handle(async () => {
  const userId = await getViewerUserId();
  return ok(userId ? await cartService.get(userId) : empty);
});

export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const { productId, quantity } = addToCartSchema.parse(await readJson(req));
  return ok(await cartService.add(await getOrCreateViewerUserId(), productId, quantity), 201);
});
