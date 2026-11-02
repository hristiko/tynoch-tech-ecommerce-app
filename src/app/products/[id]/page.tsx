import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/AddToCartButton";
import ImageGallery from "@/components/ImageGallery";
import ProductGrid from "@/components/ProductGrid";
import WishlistButton from "@/components/WishlistButton";
import { catalogService } from "@/services/catalog";
import { getViewerWishlistIds } from "@/services/viewer";
import { NotFoundError } from "@/lib/errors";
import { formatPrice } from "@/lib/utils";
import { productIdSchema } from "@/lib/validation";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

async function load(rawId: string): Promise<Product> {
  const id = productIdSchema.safeParse(rawId);
  if (!id.success) notFound();
  try {
    return await catalogService.getProduct(id.data);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const p = await load(params.id);
    return { title: p.name, description: p.description };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await load(params.id);
  const [related, category, wishlistIds] = await Promise.all([
    catalogService.getRelated(product),
    catalogService.getCategory(product.categorySlug).catch(() => null),
    getViewerWishlistIds(),
  ]);

  const stockLabel = product.stock < 1 ? "Sold out" : product.stock <= 10 ? `Only ${product.stock} left` : "In stock";

  return (
    <div className="space-y-16">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/products" className="hover:text-ink">Shop</Link>
        {category && <> / <Link href={`/products?category=${category.slug}`} className="hover:text-ink">{category.name}</Link></>}
        {" / "}<span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <ImageGallery images={product.images} alt={product.name} />
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold">{formatPrice(product.priceCents)}</p>
          <p className="mt-1 text-sm text-muted">Rated {product.rating.toFixed(1)} out of 5</p>
          <p className="mt-6 max-w-prose leading-relaxed">{product.description}</p>
          <p className={`mt-6 text-sm font-semibold ${product.stock < 1 ? "text-red-700" : product.stock <= 10 ? "text-amber-800" : "text-green-800"}`}>{stockLabel}</p>

          <div className="mt-4 max-w-sm space-y-3">
            <AddToCartButton productId={product.id} stock={product.stock} showQuantity />
            <WishlistButton productId={product.id} initial={wishlistIds.has(product.id)} variant="full" />
          </div>

          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
            {product.tags.map((t) => (
              <li key={t}><Link href={`/products?q=${encodeURIComponent(t)}`} className="rounded-full border border-ink/20 px-3 py-1 text-sm hover:border-ink">{t}</Link></li>
            ))}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related">
          <h2 id="related" className="mb-6 text-2xl font-bold">You might also like</h2>
          <ProductGrid products={related} wishlistIds={wishlistIds} />
        </section>
      )}
    </div>
  );
}
