import { NextRequest } from "next/server";
import { catalogFailure, catalogResponse, checkMutationOrigin, readCatalogBody, requireAdminRequest } from "@/lib/admin-api";
import { createProduct, listProducts } from "@/lib/catalog-db";
import { parseProductDraft } from "@/lib/catalog-model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    return catalogResponse(await listProducts());
  } catch (error) { return catalogFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    return catalogResponse(await createProduct(parseProductDraft(await readCatalogBody(request), "create")), 201);
  } catch (error) { return catalogFailure(error); }
}
