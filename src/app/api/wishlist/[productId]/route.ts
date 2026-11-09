import { requireSameOrigin } from "@/lib/origin";
import { wishlistService } from "@/services/wishlist";
import { handle, ok } from "@/lib/api";
import { getOrCreateViewerUserId } from "@/lib/session";
import { productIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (req: Request, { params }: { params: { productId: string } }) => {
  requireSameOrigin(req);
  const productId = productIdSchema.parse(params.productId);
  await wishlistService.remove(await getOrCreateViewerUserId(), productId);
  return ok({ removed: true });
});
