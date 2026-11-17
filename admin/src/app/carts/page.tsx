import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { listShoppingOwners } from "@/lib/customer-db";
import { AdminShell } from "@/components/AdminShell";
import { ShoppingManager } from "@/components/ShoppingManager";

export const dynamic = "force-dynamic";

export default async function AdminCartsPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const [owners, params] = await Promise.all([listShoppingOwners(), searchParams]);
  return <AdminShell adminName={admin.name} active="/carts"><ShoppingManager initial={owners} kind="cart" initialUserId={params.userId ?? ""} /></AdminShell>;
}
