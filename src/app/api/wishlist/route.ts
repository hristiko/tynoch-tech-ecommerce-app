import { requireSameOrigin } from "@/lib/origin";
import { wishlistService } from "@/services/wishlist";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateViewerUserId, getViewerUserId } from "@/lib/session";
import { wishlistSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const userId = await getViewerUserId();
  return ok(userId ? await wishlistService.getProducts(userId) : []);
});

export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const { productId } = wishlistSchema.parse(await readJson(req));
  const result = await wishlistService.add(await getOrCreateViewerUserId(), productId);
  return ok(result, result.added ? 201 : 200); // 200 = already present, nothing duplicated
});
