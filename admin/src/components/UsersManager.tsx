"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { fetchCatalog, sendCatalogRequest } from "./catalog-ui";
import type { ManagedUser, ManagedUserDetails } from "@/lib/customer-model";

const inputClass = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-moss";
const pageSize = 8;

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function UsersManager({ initialUsers, adminId }: { initialUsers: ManagedUser[]; adminId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ManagedUserDetails | null>(null);
  const [editName, setEditName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshUsers = useCallback(async () => {
    setUsers(await fetchCatalog<ManagedUser[]>("/api/admin/users"));
  }, []);

  const refreshDetails = useCallback(async (id: string) => {
    const result = await fetchCatalog<ManagedUserDetails>(`/api/admin/users/${encodeURIComponent(id)}`);
    setDetails(result);
    return result;
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void fetchCatalog<ManagedUserDetails>(`/api/admin/users/${encodeURIComponent(selectedId)}`)
      .then(result => {
        if (!active) return;
        setDetails(result);
        setEditName(result.user.name);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load account."); })
      .finally(() => { if (active) setLoadingDetails(false); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy && !editing) {
        void refreshUsers().catch(() => undefined);
        if (selectedId) void refreshDetails(selectedId).catch(() => undefined);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshUsers, refreshDetails, selectedId, editing, busy]);

  const filtered = useMemo(() => users.filter(user => {
    const matches = `${user.name} ${user.email} ${user.id}`.toLowerCase().includes(query.trim().toLowerCase());
    return matches && (role === "all" || user.role === role);
  }), [users, query, role]);
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shownPage = Math.min(page, maxPage);
  const displayed = filtered.slice((shownPage - 1) * pageSize, shownPage * pageSize);

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await sendCatalogRequest<ManagedUser>(`/api/admin/users/${encodeURIComponent(details.user.id)}`, "PUT", {
        name: editName.trim(), expectedUpdatedAt: details.user.updatedAt,
      });
      setEditing(false);
      await Promise.all([refreshUsers(), refreshDetails(updated.id)]);
      setNotice("Customer display name saved. The storefront will use the updated profile.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update customer.");
    } finally { setBusy(false); }
  }

  async function deleteUser(user: ManagedUser) {
    if (user.role === "admin" || user.id === adminId) return;
    const confirmedEmail = window.prompt(`Delete ${user.name || user.email} permanently?\n\nThis removes the account, login credentials, cart and wishlist.\n\nType the FULL account email to confirm:`);
    if (confirmedEmail === null) return;
    if (confirmedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError("The confirmation email did not match. Nothing was deleted.");
      return;
    }
    if (!window.confirm(`Final confirmation: permanently delete ${user.email}? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendCatalogRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, "DELETE", {
        expectedUpdatedAt: user.updatedAt, confirmEmail: user.email,
      });
      setSelectedId(null);
      setDetails(null);
      setLoadingDetails(false);
      await refreshUsers();
      setNotice(`Deleted the customer account ${user.email} and its associated shopping data.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete customer account.");
    } finally { setBusy(false); }
  }

  async function manualRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await refreshUsers();
      if (selectedId) await refreshDetails(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh user data.");
    } finally { setRefreshing(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-moss">Accounts</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">User management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Registered customers and administrators. Account email addresses and access roles cannot be changed here.</p>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[190px] flex-1 space-y-1 text-xs font-medium text-slate-600">Search accounts
            <input type="search" className={inputClass} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Name, email or account ID" />
          </label>
          <label className="min-w-[140px] space-y-1 text-xs font-medium text-slate-600">Role
            <select className={inputClass} value={role} onChange={event => { setRole(event.target.value); setPage(1); }}>
              <option value="all">All roles</option><option value="customer">Customers</option><option value="admin">Administrators</option>
            </select>
          </label>
          <button type="button" disabled={busy || refreshing} onClick={() => void manualRefresh()} className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper">{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
        <p className="text-xs text-slate-500">Showing {filtered.length} of {users.length} registered accounts. The list refreshes every 15 seconds.</p>
        {filtered.length === 0 ? (
          <p className="rounded-lg bg-paper px-4 py-8 text-center text-sm text-slate-600">No accounts match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-slate-500"><th className="py-3 pr-4 font-medium">Account</th><th className="py-3 pr-4 font-medium">Role</th><th className="py-3 pr-4 font-medium">Joined</th><th className="py-3 text-right font-medium">Actions</th></tr></thead>
              <tbody>{displayed.map(user => (
                <tr key={user.id} className={`border-b border-line last:border-0 ${selectedId === user.id ? "bg-paper/70" : ""}`}>
                  <td className="py-4 pr-4"><p className="font-medium text-ink">{user.name || "Unnamed account"}</p><p className="mt-1 text-xs text-slate-600">{user.email}</p></td>
                  <td className="py-4 pr-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.role === "admin" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-700"}`}>{user.role === "admin" ? "Administrator" : "Customer"}</span></td>
                  <td className="py-4 pr-4 text-slate-600">{formatDate(user.createdAt)}</td>
                  <td className="py-4 text-right"><div className="flex justify-end gap-3">
                    <button type="button" disabled={busy} className="font-medium text-moss hover:underline" onClick={() => { if (selectedId !== user.id) { setLoadingDetails(true); setDetails(null); setSelectedId(user.id); } setEditing(false); setError(""); setNotice(""); }}>Details</button>
                    <button type="button" disabled={busy || user.role === "admin" || user.id === adminId} title={user.role === "admin" ? "Administrator accounts cannot be deleted from this page" : "Delete customer account"} className="font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-30" onClick={() => void deleteUser(user)}>Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {maxPage > 1 && <div className="flex items-center justify-end gap-3 border-t border-line pt-4 text-sm"><button type="button" disabled={shownPage <= 1} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" onClick={() => setPage(shownPage - 1)}>Previous</button><span>Page {shownPage} of {maxPage}</span><button type="button" disabled={shownPage >= maxPage} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" onClick={() => setPage(shownPage + 1)}>Next</button></div>}
      </section>
      {selectedId && <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-label="Selected account details">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Account details</h2><p className="mt-1 text-xs text-slate-500">{selectedId}</p></div><button type="button" className="text-sm font-medium text-slate-600 hover:underline" onClick={() => { setSelectedId(null); setDetails(null); setEditing(false); setLoadingDetails(false); }}>Close</button></div>
        {loadingDetails && <p className="text-sm text-slate-600">Loading account details…</p>}
        {details && details.user.id === selectedId && <>
          <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-medium">{details.user.email}</dd></div><div><dt className="text-slate-500">Last profile update</dt><dd className="mt-1 font-medium">{formatDate(details.user.updatedAt)}</dd></div><div><dt className="text-slate-500">Cart</dt><dd className="mt-1 font-medium">{details.shopping.owner.cartLines} lines / {details.shopping.owner.cartQuantity} items</dd></div><div><dt className="text-slate-500">Wishlist</dt><dd className="mt-1 font-medium">{details.shopping.owner.wishlistItems} saved items</dd></div></dl>
          <div className="flex flex-wrap gap-3"><Link className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-paper" href={`/carts?userId=${encodeURIComponent(selectedId)}`}>View cart</Link><Link className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-paper" href={`/wishlists?userId=${encodeURIComponent(selectedId)}`}>View wishlist</Link></div>
          {editing ? <form onSubmit={event => void updateUser(event)} className="space-y-3 border-t border-line pt-5"><label className="block max-w-md space-y-1.5 text-sm font-medium">Display name<input className={inputClass} minLength={2} maxLength={100} required value={editName} disabled={busy} onChange={event => setEditName(event.target.value)} /></label><div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white">{busy ? "Saving…" : "Save name"}</button><button type="button" disabled={busy} onClick={() => setEditing(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium">Cancel</button></div></form> : <button type="button" disabled={busy} onClick={() => { setEditName(details.user.name); setEditing(true); }} className="rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white">Edit display name</button>}
          <p className="border-t border-line pt-4 text-xs text-slate-500">Password hashes are never sent to this page. Administrator roles cannot be assigned or deleted here.</p>
        </>}
      </section>}
    </div>
  );
}
