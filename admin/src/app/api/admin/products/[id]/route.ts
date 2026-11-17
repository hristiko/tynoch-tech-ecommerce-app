import { NextRequest } from "next/server";
import { catalogFailure, catalogResponse, checkMutationOrigin, readCatalogBody, requireAdminRequest } from "@/lib/admin-api";
import { deleteProduct, updateProduct } from "@/lib/catalog-db";
import { CatalogError, isSlug, parseProductDraft } from "@/lib/catalog-model";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const { id } = await context.params;
    if (!isSlug(id)) throw new CatalogError("Invalid product ID.", 400);
    return catalogResponse(await updateProduct(id, parseProductDraft(await readCatalogBody(request), "update")));
  } catch (error) { return catalogFailure(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const { id } = await context.params;
    if (!isSlug(id)) throw new CatalogError("Invalid product ID.", 400);
    const body = await readCatalogBody(request);
    const revision = (body as { expectedRevision?: unknown } | null)?.expectedRevision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) {
      throw new CatalogError("A valid revision is required.", 400);
    }
    await deleteProduct(id, revision);
    return catalogResponse({ deleted: true });
  } catch (error) { return catalogFailure(error); }
}
