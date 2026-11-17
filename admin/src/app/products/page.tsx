import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { listCategories, listProducts } from "@/lib/catalog-db";
import { AdminShell } from "@/components/AdminShell";
import { ProductsManager } from "@/components/ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  return (
    <AdminShell adminName={admin.name} active="/products">
      <ProductsManager initialProducts={products} initialCategories={categories} />
    </AdminShell>
  );
}
