import { NextRequest } from "next/server";
import { catalogResponse, requireAdminRequest } from "@/lib/admin-api";
import { customerFailure } from "@/lib/customer-api";
import { getShoppingDetails } from "@/lib/customer-db";
import { CustomerError, isShopperId } from "@/lib/customer-model";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    const { id } = await context.params;
    if (!isShopperId(id)) throw new CustomerError("Invalid shopper identifier.", 400);
    return catalogResponse(await getShoppingDetails(id));
  } catch (error) { return customerFailure(error); }
}
