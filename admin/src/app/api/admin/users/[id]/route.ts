import { NextRequest } from "next/server";
import { catalogResponse, checkMutationOrigin, readCatalogBody, requireAdminRequest } from "@/lib/admin-api";
import { getCurrentAdmin } from "@/lib/admin-session";
import { customerFailure } from "@/lib/customer-api";
import { deleteRegisteredUser, getUserDetails, updateRegisteredUser } from "@/lib/customer-db";
import { CustomerError, isAccountId, parseAccountDeletion, parseAccountUpdate } from "@/lib/customer-model";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    const { id } = await context.params;
    if (!isAccountId(id)) throw new CustomerError("Invalid account identifier.", 400);
    return catalogResponse(await getUserDetails(id));
  } catch (error) { return customerFailure(error); }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const { id } = await context.params;
    if (!isAccountId(id)) throw new CustomerError("Invalid account identifier.", 400);
    const draft = parseAccountUpdate(await readCatalogBody(request));
    return catalogResponse(await updateRegisteredUser(id, draft));
  } catch (error) { return customerFailure(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    checkMutationOrigin(request);
    const actor = await getCurrentAdmin();
    if (!actor) throw new CustomerError("Administrator session is no longer active.", 403);
    const { id } = await context.params;
    if (!isAccountId(id)) throw new CustomerError("Invalid account identifier.", 400);
    const draft = parseAccountDeletion(await readCatalogBody(request));
    await deleteRegisteredUser(id, actor.id, draft);
    return catalogResponse({ deleted: true });
  } catch (error) { return customerFailure(error); }
}
