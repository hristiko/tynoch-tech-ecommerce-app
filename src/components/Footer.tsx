import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>Tidewell. A demo storefront built with Next.js and DynamoDB.</p>
        <div className="flex gap-5">
          <Link href="/products" className="hover:text-ink">Shop</Link>
          <Link href="/wishlist" className="hover:text-ink">Wishlist</Link>
          <Link href="/cart" className="hover:text-ink">Cart</Link>
        </div>
      </div>
    </footer>
  );
}
