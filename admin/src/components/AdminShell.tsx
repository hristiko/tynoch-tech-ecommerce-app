import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/users", label: "Users" },
  { href: "/carts", label: "Carts" },
  { href: "/wishlists", label: "Wishlists" },
];

export function AdminShell({
  adminName,
  active,
  children,
}: {
  adminName: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div>
            <Link href="/" className="text-xl font-bold tracking-tight text-ink">
              Tidewell <span className="font-normal text-slate-500">/ Admin</span>
            </Link>
            <p className="mt-1 text-xs text-slate-500">Store management</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{adminName}</span>
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Admin navigation" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 pb-3 sm:px-8">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={active === href ? "page" : undefined}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${active === href ? "bg-moss text-white" : "text-slate-600 hover:bg-paper hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}
