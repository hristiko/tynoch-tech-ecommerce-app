import { catalogService } from "@/services/catalog";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok(await catalogService.listCategories()));
