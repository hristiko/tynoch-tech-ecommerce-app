"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SalesFilter, SalesSummary } from "@/lib/sales-model";

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const money = (cents: number) => euro.format(cents / 100);
const count = (value: number) => new Intl.NumberFormat("en-IE").format(value);
const sourceChoices: { value: SalesFilter; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "demo", label: "Demo orders only" },
  { value: "storefront", label: "Storefront orders only" },
];

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function MonthlySales({ months }: { months: SalesSummary["monthly"] }) {
  const maximum = Math.max(1, ...months.map(month => month.revenueCents));
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6" aria-label="Monthly completed order revenue">
      <h3 className="text-base font-semibold text-ink">Revenue by month</h3>
      <p className="mt-1 text-xs text-slate-500">Last six calendar months · Completed orders only</p>
      <div className="mt-7 grid h-64 grid-cols-6 items-end gap-2 sm:gap-5" role="img" aria-label={months.map(m => `${m.label}: ${money(m.revenueCents)}, ${m.completedOrders} completed orders`).join("; ")}>
        {months.map(month => (
          <div key={month.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
            <p className="hidden text-xs font-medium tabular-nums text-slate-600 sm:block">{money(month.revenueCents)}</p>
            <div className="flex h-48 w-full items-end justify-center border-b border-line">
              <div className="w-full max-w-16 rounded-t-md bg-moss transition-[height] duration-200"
                style={{ height: month.revenueCents ? `${Math.max(3, month.revenueCents / maximum * 100)}%` : "0%" }}
                title={`${month.month}: ${money(month.revenueCents)} from ${month.completedOrders} completed orders`} />
            </div>
            <span className="text-xs font-medium text-slate-600">{month.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBreakdown({ stats }: { stats: SalesSummary }) {
  const rows = [
    { label: "Completed", amount: stats.completedCount, color: "bg-moss" },
    { label: "Pending", amount: stats.pendingCount, color: "bg-amber-500" },
    { label: "Cancelled", amount: stats.cancelledCount, color: "bg-slate-400" },
  ];
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-ink">Order status</h3>
      <p className="mt-1 text-xs text-slate-500">Across all recorded months in the selected dataset</p>
      <div className="mt-8 space-y-5">
        {rows.map(row => (
          <div key={row.label}>
            <div className="mb-2 flex justify-between gap-3 text-sm"><span>{row.label}</span><span className="font-semibold tabular-nums">{count(row.amount)}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${stats.orderCount ? row.amount / stats.orderCount * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BestSellers({ products }: { products: SalesSummary["topProducts"] }) {
  const maximum = Math.max(1, ...products.map(item => item.quantity));
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-ink">Best-selling products</h3>
      <p className="mt-1 text-xs text-slate-500">Units sold in completed orders; historical product snapshots</p>
      {products.length === 0 ? <p className="mt-6 text-sm text-slate-500">No completed orders in this dataset.</p> : (
        <div className="mt-6 space-y-4">
          {products.map(product => (
            <div key={product.productId}>
              <div className="mb-2 flex justify-between gap-3 text-sm"><span className="truncate">{product.name}</span><span className="shrink-0 font-medium tabular-nums">{count(product.quantity)} units</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-moss/80" style={{ width: `${product.quantity / maximum * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function SalesPanel({ initial }: { initial: SalesSummary }) {
  const [filter, setFilter] = useState<SalesFilter>(initial.filter);
  const [stats, setStats] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestCounter = useRef(0);

  const refresh = useCallback(async (source: SalesFilter) => {
    const requestId = ++requestCounter.current;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/sales?source=${encodeURIComponent(source)}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sales statistics could not be refreshed.");
      const payload = (await response.json()) as { data: SalesSummary };
      if (requestCounter.current === requestId) {
        setStats(payload.data);
        setError("");
      }
    } catch {
      if (requestCounter.current === requestId) setError("Could not refresh sales data. Showing the last successful result.");
    } finally {
      if (requestCounter.current === requestId) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(filter);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [filter, refresh]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Orders and sales</h2>
          <p className="mt-1 text-sm text-slate-500">Figures are derived from DynamoDB orders, not from shopping carts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sales-source" className="text-xs font-medium text-slate-600">Data source</label>
          <select id="sales-source" value={filter} onChange={event => {
            const selected = event.target.value as SalesFilter;
            setFilter(selected);
            void refresh(selected);
          }} className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
            {sourceChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
          <button type="button" onClick={() => void refresh(filter)} disabled={busy}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-paper">
            {busy ? "Refreshing..." : "Refresh sales"}
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" role="note">
        <strong>Demo data:</strong> {count(stats.sourceTotals.demo)} synthetic orders · {count(stats.sourceTotals.storefront)} storefront orders.
        The synthetic transactions are for dashboard testing and do not represent real purchases.
      </div>
      {error && <p role="status" className="text-sm text-amber-800">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Completed-order revenue" value={money(stats.revenueCents)} note="Excludes pending and cancelled orders" />
        <Metric label="All orders" value={count(stats.orderCount)} note="Across the selected source and all months" />
        <Metric label="Completed orders" value={count(stats.completedCount)} note="Counted toward revenue" />
        <Metric label="Average order value" value={money(stats.averageOrderValueCents)} note="Revenue divided by completed orders" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlySales months={stats.monthly} />
        <StatusBreakdown stats={stats} />
      </div>
      <BestSellers products={stats.topProducts} />
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h3 className="text-base font-semibold text-ink">Recent orders</h3>
        <p className="mt-1 text-xs text-slate-500">The eight newest records for the selected source</p>
        {stats.recentOrders.length === 0 ? <p className="mt-5 text-sm text-slate-500">No orders found for this source.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-3 pr-4 font-medium">Order</th>
                <th scope="col" className="py-3 pr-4 font-medium">Customer</th>
                <th scope="col" className="py-3 pr-4 font-medium">Date</th>
                <th scope="col" className="py-3 pr-4 font-medium">Status</th>
                <th scope="col" className="py-3 pr-4 font-medium">Source</th>
                <th scope="col" className="py-3 text-right font-medium">Total</th>
              </tr></thead>
              <tbody>{stats.recentOrders.map(order => (
                <tr key={order.id} className="border-b border-line/70 last:border-0">
                  <td className="py-3 pr-4 font-mono text-xs">{order.id}</td>
                  <td className="py-3 pr-4">{order.customerName}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="py-3 pr-4 capitalize">{order.status}</td>
                  <td className="py-3 pr-4 capitalize">{order.source}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{money(order.totalCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500">Sales last updated {new Date(stats.recordedAt).toLocaleString()}. Data refreshes every 15 seconds while this tab is visible. Newly written records on the DynamoDB index may take a short time to appear.</p>
    </div>
  );
}
