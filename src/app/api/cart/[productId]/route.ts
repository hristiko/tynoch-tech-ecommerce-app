import { cartService } from "@/services/cart";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/session";
import { productIdSchema, updateCartSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: { productId: string } };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const productId = productIdSchema.parse(params.productId);
  const { quantity } = updateCartSchema.parse(await readJson(req));
  return ok(await cartService.setQuantity(getOrCreateUserId(), productId, quantity));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const productId = productIdSchema.parse(params.productId);
  return ok(await cartService.remove(getOrCreateUserId(), productId));
});
