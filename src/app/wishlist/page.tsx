import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import ProductGrid from "@/components/ProductGrid";
import { wishlistService } from "@/services/wishlist";
import { getViewerUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const userId = await getViewerUserId();
  const products = userId ? await wishlistService.getProducts(userId) : [];
  return (
    <div>
      <h1 className="mb-8 text-4xl font-extrabold">Wishlist</h1>
      {products.length === 0 ? (
        <EmptyState title="Nothing saved yet" message="Tap the heart on any product to keep it here for later." actionHref="/products" actionLabel="Find something you like" />
      ) : (
        <ProductGrid products={products} wishlistIds={new Set(products.map((p) => p.id))} />
      )}
    </div>
  );
}
