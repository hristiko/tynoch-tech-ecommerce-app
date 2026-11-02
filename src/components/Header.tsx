import Link from "next/link";
import { getViewerCartCount } from "@/services/viewer";

export default async function Header() {
  const count = await getViewerCartCount();
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-mineral/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">Tidewell</Link>
        <nav aria-label="Main" className="order-3 flex w-full gap-5 text-sm font-medium sm:order-none sm:w-auto">
          <Link href="/products" className="hover:text-cobalt">Shop</Link>
          <Link href="/products?category=desk" className="hover:text-cobalt">Desk</Link>
          <Link href="/products?category=kitchen" className="hover:text-cobalt">Kitchen</Link>
          <Link href="/products?category=living" className="hover:text-cobalt">Living</Link>
        </nav>
        <form action="/products" role="search" className="ml-auto flex-1 sm:max-w-xs">
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <input id="site-search" name="q" type="search" maxLength={80} placeholder="Search products" className="field py-2" />
        </form>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/wishlist" className="hover:text-cobalt">Wishlist</Link>
          <Link href="/account" className="hover:text-cobalt">Account</Link>
          <Link href="/cart" className="btn-primary py-2" aria-label={`Cart, ${count} items`}>
            Cart
            <span className="rounded bg-white/20 px-1.5 text-xs tabular-nums">{count}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
