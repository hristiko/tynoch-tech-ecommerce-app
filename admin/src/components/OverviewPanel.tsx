"use client";

import { useCallback, useEffect, useState } from "react";
import type { Overview } from "@/lib/db";

const cards: { field: "users" | "products" | "categories" | "cartItems" | "wishlistItems"; label: string; note: string }[] = [
  { field: "users", label: "Registered users", note: "Customer and admin accounts" },
  { field: "products", label: "Products", note: "Catalogue records" },
  { field: "categories", label: "Categories", note: "Store categories" },
  { field: "cartItems", label: "Cart lines", note: "Across all visitors" },
  { field: "wishlistItems", label: "Wishlist entries", note: "Across all visitors" },
];

export function OverviewPanel({ initial }: { initial: Overview }) {
  const [stats, setStats] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Dashboard data could not be refreshed.");
      const result = (await response.json()) as { data: Overview };
      setStats(result.data);
      setError("");
    } catch {
      setError("Could not refresh. Values shown are from the last successful request.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Store activity</h2>
          <p className="mt-1 text-sm text-slate-500">Live counts from the same DynamoDB table as the storefront.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy}
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper">
          {busy ? "Refreshing…" : "Refresh now"}
        </button>
      </div>
      {error && <p role="status" className="text-sm text-amber-800">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ field, label, note }) => (
          <div key={field} className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-ink tabular-nums">{stats[field].toLocaleString()}</p>
            <p className="mt-3 text-xs text-slate-500">{note}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Last updated {new Date(stats.recordedAt).toLocaleString()}. Automatically checks for changes every 15 seconds while this tab is open.
      </p>

    </div>
  );
}
