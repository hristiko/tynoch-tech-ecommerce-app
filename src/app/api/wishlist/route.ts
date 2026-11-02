import { wishlistService } from "@/services/wishlist";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateUserId, getUserId } from "@/lib/session";
import { wishlistSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const userId = getUserId();
  return ok(userId ? await wishlistService.getProducts(userId) : []);
});

export const POST = handle(async (req: Request) => {
  const { productId } = wishlistSchema.parse(await readJson(req));
  const result = await wishlistService.add(getOrCreateUserId(), productId);
  return ok(result, result.added ? 201 : 200); // 200 = already present, nothing duplicated
});
