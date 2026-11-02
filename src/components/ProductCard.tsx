import Link from "next/link";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import WishlistButton from "./WishlistButton";

interface Props { product: Product; wishlisted: boolean }

export default function ProductCard({ product, wishlisted }: Props) {
  const soldOut = product.stock < 1;
  return (
    <article className="group relative">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-sand/50">
          <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          {soldOut && <span className="absolute bottom-2 left-2 rounded bg-ink px-2 py-1 text-xs font-semibold text-white">Sold out</span>}
        </div>
        <h3 className="mt-3 text-base font-semibold leading-snug">{product.name}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {formatPrice(product.priceCents)} <span aria-hidden="true">·</span> <span aria-label={`Rated ${product.rating} out of 5`}>{product.rating.toFixed(1)} / 5</span>
        </p>
      </Link>
      <WishlistButton productId={product.id} initial={wishlisted} className="absolute right-2 top-2" />
    </article>
  );
}
