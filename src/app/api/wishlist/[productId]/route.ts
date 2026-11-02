import { wishlistService } from "@/services/wishlist";
import { handle, ok } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/session";
import { productIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (_req: Request, { params }: { params: { productId: string } }) => {
  const productId = productIdSchema.parse(params.productId);
  await wishlistService.remove(getOrCreateUserId(), productId);
  return ok({ removed: true });
});
