import { catalogService } from "@/services/catalog";
import { handle, ok } from "@/lib/api";
import { productIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = productIdSchema.parse((await params).id);
  const product = await catalogService.getProduct(id);
  const related = await catalogService.getRelated(product);
  return ok({ product, related });
});
