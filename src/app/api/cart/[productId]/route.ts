import { requireSameOrigin } from "@/lib/origin";
import { cartService } from "@/services/cart";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateViewerUserId } from "@/lib/session";
import { productIdSchema, updateCartSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ productId: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  requireSameOrigin(req);
  const productId = productIdSchema.parse((await params).productId);
  const { quantity } = updateCartSchema.parse(await readJson(req));
  return ok(await cartService.setQuantity(await getOrCreateViewerUserId(), productId, quantity));
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  requireSameOrigin(req);
  const productId = productIdSchema.parse((await params).productId);
  return ok(await cartService.remove(await getOrCreateViewerUserId(), productId));
});
