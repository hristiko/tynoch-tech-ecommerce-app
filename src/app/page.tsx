import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import { catalogService } from "@/services/catalog";
import { getViewerWishlistIds } from "@/services/viewer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featured, wishlistIds] = await Promise.all([
    catalogService.listCategories(),
    catalogService.getFeatured(4),
    getViewerWishlistIds(),
  ]);

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-4 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
            Objects for the room where you work and live.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Lamps, cookware, linen and bags chosen for daily use. Small batches, honest materials, fair prices.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary px-6 py-3 text-base">Shop all products</Link>
            <Link href="/products?sort=rating" className="btn-outline px-6 py-3 text-base">Top rated</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          {featured.slice(0, 3).map((p, i) => (
            <div key={p.id} className={`overflow-hidden rounded-lg bg-sand/50 ${i === 0 ? "row-span-2" : ""}`}>
              <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="text-2xl font-bold">Shop by category</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.slug} href={`/products?category=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-lg bg-sand/50">
              <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-4 text-white">
                <h3 className="text-lg font-bold">{c.name}</h3>
                <p className="text-sm text-white/80 line-clamp-2">{c.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured">
        <div className="flex items-end justify-between">
          <h2 id="featured" className="text-2xl font-bold">Customer favourites</h2>
          <Link href="/products?sort=rating" className="text-sm font-semibold text-cobalt hover:underline">See all top rated</Link>
        </div>
        <div className="mt-6"><ProductGrid products={featured} wishlistIds={wishlistIds} /></div>
      </section>
    </div>
  );
}
