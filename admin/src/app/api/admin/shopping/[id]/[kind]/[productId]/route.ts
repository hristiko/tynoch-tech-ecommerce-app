import { NextRequest } from "next/server";
import { catalogResponse, checkMutationOrigin, readCatalogBody, requireAdminRequest } from "@/lib/admin-api";
import { customerFailure } from "@/lib/customer-api";
import { removeShoppingItem } from "@/lib/customer-db";
import { CustomerError, isProductId, isShopperId, parseShoppingRemoval } from "@/lib/customer-model";

type Context = { params: Promise<{ id: string; kind: string; productId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const { id, kind, productId } = await context.params;
    if (!isShopperId(id) || !isProductId(productId)) throw new CustomerError("Invalid shopping item identifier.", 400);
    const draft = parseShoppingRemoval(kind, await readCatalogBody(request));
    await removeShoppingItem(id, kind, productId, draft);
    return catalogResponse({ deleted: true });
  } catch (error) { return customerFailure(error); }
}
