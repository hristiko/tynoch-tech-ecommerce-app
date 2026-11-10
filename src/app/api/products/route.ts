import { catalogService } from "@/services/catalog";
import { handle, ok } from "@/lib/api";
import { productQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = productQuerySchema.parse(params);
  const products = await catalogService.searchProducts({
    q: parsed.q,
    category: parsed.category,
    sort: parsed.sort,
    minPriceCents: parsed.min !== undefined ? Math.round(parsed.min * 100) : undefined,
    maxPriceCents: parsed.max !== undefined ? Math.round(parsed.max * 100) : undefined,
  });
  return ok(products);
});
