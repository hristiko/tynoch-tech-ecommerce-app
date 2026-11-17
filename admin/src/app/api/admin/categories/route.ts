import { NextRequest } from "next/server";
import { catalogFailure, catalogResponse, checkMutationOrigin, readCatalogBody, requireAdminRequest } from "@/lib/admin-api";
import { createCategory, listCategories } from "@/lib/catalog-db";
import { parseCategoryDraft } from "@/lib/catalog-model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    return catalogResponse(await listCategories());
  } catch (error) { return catalogFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    return catalogResponse(await createCategory(parseCategoryDraft(await readCatalogBody(request), "create")), 201);
  } catch (error) { return catalogFailure(error); }
}
