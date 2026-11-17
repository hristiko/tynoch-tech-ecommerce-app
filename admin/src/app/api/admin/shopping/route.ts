import { catalogResponse, requireAdminRequest } from "@/lib/admin-api";
import { customerFailure } from "@/lib/customer-api";
import { listShoppingOwners } from "@/lib/customer-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const denied = await requireAdminRequest();
    if (denied) return denied;
    return catalogResponse(await listShoppingOwners());
  } catch (error) { return customerFailure(error); }
}
