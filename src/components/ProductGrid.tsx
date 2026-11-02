import type { Product } from "@/types";
import ProductCard from "./ProductCard";

export default function ProductGrid({ products, wishlistIds }: { products: Product[]; wishlistIds: Set<string> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} wishlisted={wishlistIds.has(p.id)} />)}
    </div>
  );
}
