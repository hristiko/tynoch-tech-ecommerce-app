import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getOverview } from "@/lib/db";
import { getSalesOverview } from "@/lib/sales-db";
import { OverviewPanel } from "@/components/OverviewPanel";
import { SalesPanel } from "@/components/SalesPanel";
import { AdminShell } from "@/components/AdminShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const [stats, sales] = await Promise.all([getOverview(), getSalesOverview()]);

  return (
    <AdminShell adminName={admin.name} active="/">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-moss">Overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-3 text-sm text-slate-600">The storefront and admin site share the same database.</p>
      </div>
      <OverviewPanel initial={stats} />
      <SalesPanel initial={sales} />
    </AdminShell>
  );
}
