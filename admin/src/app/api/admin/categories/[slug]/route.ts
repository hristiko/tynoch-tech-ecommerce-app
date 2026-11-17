import { NextRequest } from "next/server";
import { catalogFailure, catalogResponse, checkMutationOrigin, readCatalogBody, requireAdminRequest } from "@/lib/admin-api";
import { deleteCategory, updateCategory } from "@/lib/catalog-db";
import { CatalogError, isSlug, parseCategoryDraft } from "@/lib/catalog-model";

type Context = { params: Promise<{ slug: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const { slug } = await context.params;
    if (!isSlug(slug)) throw new CatalogError("Invalid category slug.", 400);
    return catalogResponse(await updateCategory(slug, parseCategoryDraft(await readCatalogBody(request), "update")));
  } catch (error) { return catalogFailure(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const { slug } = await context.params;
    if (!isSlug(slug)) throw new CatalogError("Invalid category slug.", 400);
    const body = await readCatalogBody(request);
    const revision = (body as { expectedRevision?: unknown } | null)?.expectedRevision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) {
      throw new CatalogError("A valid revision is required.", 400);
    }
    await deleteCategory(slug, revision);
    return catalogResponse({ deleted: true });
  } catch (error) { return catalogFailure(error); }
}
