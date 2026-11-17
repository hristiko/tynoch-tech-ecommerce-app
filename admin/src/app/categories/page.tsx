import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { listCategories, listProducts } from "@/lib/catalog-db";
import { AdminShell } from "@/components/AdminShell";
import { CategoriesManager } from "@/components/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  return (
    <AdminShell adminName={admin.name} active="/categories">
      <CategoriesManager initialCategories={categories} initialProducts={products} />
    </AdminShell>
  );
}
