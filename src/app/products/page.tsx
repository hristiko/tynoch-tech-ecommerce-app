import type { Metadata } from "next";
import FilterBar from "@/components/FilterBar";
import ProductGrid from "@/components/ProductGrid";
import EmptyState from "@/components/EmptyState";
import { catalogService } from "@/services/catalog";
import { getViewerWishlistIds } from "@/services/viewer";
import type { z } from "zod";
import { productQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== "" && v !== undefined)
  );
  const parsed = productQuerySchema.safeParse(raw);
  const invalid = !parsed.success;
  const q: z.infer<typeof productQuerySchema> = parsed.success ? parsed.data : {};

  const [categories, products, wishlistIds] = await Promise.all([
    catalogService.listCategories(),
    catalogService.searchProducts({
      q: q.q,
      category: q.category,
      sort: q.sort,
      minPriceCents: q.min !== undefined ? Math.round(q.min * 100) : undefined,
      maxPriceCents: q.max !== undefined ? Math.round(q.max * 100) : undefined,
    }),
    getViewerWishlistIds(),
  ]);

  const current = categories.find((c) => c.slug === q.category);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold">{current ? current.name : q.q ? `Results for “${q.q}”` : "All products"}</h1>
        <p className="mt-2 text-muted">{current?.description ?? `${products.length} ${products.length === 1 ? "product" : "products"}`}</p>
      </div>

      <FilterBar
        categories={categories}
        values={{ q: q.q, category: q.category, min: q.min?.toString(), max: q.max?.toString(), sort: q.sort }}
      />

      {invalid && (
        <p role="alert" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some filters in the link weren’t valid, so they were ignored.
        </p>
      )}

      {products.length === 0 ? (
        <EmptyState title="No products match" message="Try a different search term, widen the price range, or clear the filters." actionHref="/products" actionLabel="Clear filters" />
      ) : (
        <ProductGrid products={products} wishlistIds={wishlistIds} />
      )}
    </div>
  );
}
