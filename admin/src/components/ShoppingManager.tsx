"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { euros, fetchCatalog, sendCatalogRequest } from "./catalog-ui";
import { ownerLabel, type ShoppingDetails, type ShoppingKind, type ShoppingOwner, type ShoppingLine, type WishLine } from "@/lib/customer-model";

const inputClass = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-moss";
const pageSize = 8;

function formattedDate(date: string): string {
  return date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function ShoppingManager({ initial, kind, initialUserId = "" }: {
  initial: ShoppingOwner[];
  kind: ShoppingKind;
  initialUserId?: string;
}) {
  const [owners, setOwners] = useState(initial);
  const [query, setQuery] = useState("");
  const [ownerType, setOwnerType] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(initialUserId);
  const [detail, setDetail] = useState<ShoppingDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialUserId));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refreshOwners = useCallback(async () => {
    setOwners(await fetchCatalog<ShoppingOwner[]>("/api/admin/shopping"));
  }, []);

  const refreshDetail = useCallback(async (userId: string) => {
    const result = await fetchCatalog<ShoppingDetails>(`/api/admin/shopping/${encodeURIComponent(userId)}`);
    setDetail(result);
    return result;
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void fetchCatalog<ShoppingDetails>(`/api/admin/shopping/${encodeURIComponent(selectedId)}`)
      .then(result => { if (active) setDetail(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load shopping data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || busy) return;
      void refreshOwners().catch(() => undefined);
      if (selectedId) void refreshDetail(selectedId).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [busy, selectedId, refreshOwners, refreshDetail]);

  const filtered = useMemo(() => owners.filter(owner => {
    if (kind === "cart" && owner.cartLines < 1) return false;
    if (kind === "wishlist" && owner.wishlistItems < 1) return false;
    if (ownerType !== "all" && owner.kind !== ownerType) return false;
    return `${owner.name} ${owner.email} ${owner.userId}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [owners, kind, ownerType, query]);
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shownPage = Math.min(page, maxPage);
  const current = filtered.slice((shownPage - 1) * pageSize, shownPage * pageSize);
  const heading = kind === "cart" ? "Carts" : "Wishlists";
  const cart = kind === "cart";

  async function manualRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await refreshOwners();
      if (selectedId) await refreshDetail(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh shopping data.");
    } finally { setRefreshing(false); }
  }

  async function removeItem(line: ShoppingLine | WishLine) {
    if (!selectedId) return;
    const text = cart ? "cart" : "wishlist";
    if (!window.confirm(`Remove “${line.productName}” from this customer's ${text}? The change will be visible in the storefront.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = cart
        ? { expectedVersion: (line as ShoppingLine).version, expectedQuantity: (line as ShoppingLine).quantity }
        : { expectedAddedAt: line.addedAt };
      await sendCatalogRequest(`/api/admin/shopping/${encodeURIComponent(selectedId)}/${kind}/${encodeURIComponent(line.productId)}`, "DELETE", payload);
      await refreshOwners();
      try {
        await refreshDetail(selectedId);
      } catch {
        setDetail(null);
        setSelectedId("");
        setLoading(false);
      }
      setNotice(`Removed ${line.productName} from the ${text}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove shopping item.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-moss">Customer activity</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{heading}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">View {cart ? "live cart contents and quantities" : "saved wishlist products"} for registered users and guests. The storefront and admin dashboard read from the same DynamoDB records.</p>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1 space-y-1 text-xs font-medium text-slate-600">Search shoppers
            <input type="search" className={inputClass} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Name, email or shopper ID" />
          </label>
          <label className="min-w-[140px] space-y-1 text-xs font-medium text-slate-600">Account type
            <select className={inputClass} value={ownerType} onChange={event => { setOwnerType(event.target.value); setPage(1); }}>
              <option value="all">All shoppers</option><option value="registered">Registered</option><option value="guest">Guests</option><option value="orphaned">Missing profile</option>
            </select>
          </label>
          <button type="button" disabled={busy || refreshing} onClick={() => void manualRefresh()} className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper">{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
        <p className="text-xs text-slate-500">{filtered.length} shoppers with {cart ? "cart items" : "wishlist items"}. Data refreshes every 15 seconds.</p>
        {filtered.length === 0 ? <p className="rounded-lg bg-paper px-4 py-8 text-center text-sm text-slate-600">No matching shopping records found.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-slate-500"><th className="py-3 pr-4 font-medium">Shopper</th><th className="py-3 pr-4 font-medium">Type</th><th className="py-3 pr-4 text-right font-medium">{cart ? "Cart lines" : "Saved products"}</th><th className="py-3 text-right font-medium">Action</th></tr></thead>
              <tbody>{current.map(owner => (
                <tr key={owner.userId} className={`border-b border-line last:border-0 ${owner.userId === selectedId ? "bg-paper/70" : ""}`}>
                  <td className="py-4 pr-4"><p className="font-medium">{ownerLabel(owner)}</p><p className="mt-1 text-xs text-slate-500">{owner.email || owner.userId}</p></td>
                  <td className="py-4 pr-4 text-slate-600">{owner.kind === "registered" ? "Registered" : owner.kind === "guest" ? "Guest" : "Missing profile"}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{cart ? `${owner.cartLines} (${owner.cartQuantity} units)` : owner.wishlistItems}</td>
                  <td className="py-4 text-right"><button type="button" disabled={busy} className="font-medium text-moss hover:underline" onClick={() => { if (selectedId !== owner.userId) { setLoading(true); setDetail(null); setSelectedId(owner.userId); } setError(""); setNotice(""); }}>View {cart ? "cart" : "wishlist"}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {maxPage > 1 && <div className="flex items-center justify-end gap-3 border-t border-line pt-4 text-sm"><button type="button" disabled={shownPage <= 1} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" onClick={() => setPage(shownPage - 1)}>Previous</button><span>Page {shownPage} of {maxPage}</span><button type="button" disabled={shownPage >= maxPage} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" onClick={() => setPage(shownPage + 1)}>Next</button></div>}
      </section>
      {selectedId && <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-label="Selected shopper details">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{cart ? "Cart details" : "Wishlist details"}</h2><p className="mt-1 text-xs text-slate-500">{selectedId}</p></div><button type="button" className="text-sm font-medium text-slate-600 hover:underline" onClick={() => { setSelectedId(""); setDetail(null); setLoading(false); }}>Close</button></div>
        {loading && <p className="text-sm text-slate-600">Loading shopping details…</p>}
        {detail && detail.owner.userId === selectedId && <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600"><span className="font-medium text-ink">{ownerLabel(detail.owner)}</span><span>{detail.owner.email || detail.owner.kind}</span>{cart && <span>Estimated cart subtotal: <strong className="text-ink">{euros(detail.cartSubtotalCents)}</strong></span>}</div>
          {(cart ? detail.cart : detail.wishlist).length === 0 ? <p className="rounded-lg bg-paper px-4 py-8 text-center text-sm text-slate-600">This {cart ? "cart" : "wishlist"} is empty.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wider text-slate-500"><th className="py-3 pr-4 font-medium">Product</th><th className="py-3 pr-4 text-right font-medium">Current price</th>{cart && <th className="py-3 pr-4 text-right font-medium">Quantity</th>}<th className="py-3 pr-4 font-medium">Added</th><th className="py-3 text-right font-medium">Action</th></tr></thead><tbody>{(cart ? detail.cart : detail.wishlist).map(line => (
              <tr key={line.productId} className="border-b border-line last:border-0"><td className="py-4 pr-4"><p className="font-medium">{line.productName}</p><p className="mt-1 font-mono text-xs text-slate-500">{line.productId}</p>{line.stock === 0 && <p className="mt-1 text-xs text-amber-700">Out of stock</p>}</td><td className="py-4 pr-4 text-right">{line.priceCents === null ? "Not available" : euros(line.priceCents)}</td>{cart && <td className="py-4 pr-4 text-right tabular-nums">{(line as ShoppingLine).quantity}</td>}<td className="py-4 pr-4 text-slate-600">{formattedDate(line.addedAt)}</td><td className="py-4 text-right"><button type="button" disabled={busy} className="font-medium text-red-700 hover:underline disabled:opacity-40" onClick={() => void removeItem(line)}>Remove</button></td></tr>
            ))}</tbody></table></div>
          )}
          <p className="border-t border-line pt-4 text-xs text-slate-500">Cart subtotals use current product prices. Removing a record here also removes it from the customer&apos;s storefront view; it does not change inventory or sales.</p>
        </>}
      </section>}
    </div>
  );
}
