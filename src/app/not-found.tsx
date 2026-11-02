import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-display text-7xl font-extrabold text-cobalt">404</p>
      <h1 className="mt-4 text-3xl font-bold">That page doesn’t exist</h1>
      <p className="mt-3 text-muted">The link may be broken, or the product may have been removed.</p>
      <Link href="/products" className="btn-primary mt-6">Back to the shop</Link>
    </div>
  );
}
