"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { CategoryDraft, ManagedCategory, ManagedProduct } from "@/lib/catalog-model";
import { fetchCatalog, sendCatalogRequest } from "./catalog-ui";

const inputClass = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-moss";
type Editor = { mode: "create" } | { mode: "edit"; category: ManagedCategory } | null;

function CategoryForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: ManagedCategory | null;
  busy: boolean;
  onSave: (draft: CategoryDraft, isNew: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await onSave({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim(),
        image: image.trim(),
        ...(initial ? { expectedRevision: initial.revision } : {}),
      }, !initial);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save category.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{initial ? `Edit ${initial.name}` : "Add a category"}</h2>
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm font-medium text-slate-600 hover:underline">Cancel</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-medium">Category slug
          <input className={inputClass} required value={slug} onChange={(event) => setSlug(event.target.value)} disabled={!!initial || busy} minLength={2} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. stationery" />
          <span className="block text-xs font-normal text-slate-500">Permanent identifier used in the product catalogue</span>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Category name
          <input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} disabled={busy} minLength={2} maxLength={80} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">Description
        <textarea required className={inputClass} rows={3} minLength={8} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">Category image path
        <input required className={inputClass} value={image} onChange={(event) => setImage(event.target.value)} disabled={busy} placeholder="/images/categories/stationery.jpg" />
        <span className="block text-xs font-normal leading-5 text-slate-500">The corresponding file must exist in the storefront&apos;s public/images/categories folder. Uploading files is outside this stage.</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white hover:bg-moss/90">{busy ? "Saving…" : initial ? "Save changes" : "Create category"}</button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium">Cancel</button>
      </div>
    </form>
  );
}

export function CategoriesManager({ initialCategories, initialProducts }: { initialCategories: ManagedCategory[]; initialProducts: ManagedProduct[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [nextCategories, nextProducts] = await Promise.all([
      fetchCatalog<ManagedCategory[]>("/api/admin/categories"),
      fetchCatalog<ManagedProduct[]>("/api/admin/products"),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !editor && !busy) void refresh().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [busy, editor, refresh]);

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
    return counts;
  }, [products]);

  const filtered = categories.filter((category) => `${category.slug} ${category.name} ${category.description}`.toLowerCase().includes(query.toLowerCase().trim()));

  async function save(draft: CategoryDraft, isNew: boolean) {
    setBusy(true);
    setError("");
    try {
      const path = isNew ? "/api/admin/categories" : `/api/admin/categories/${encodeURIComponent(draft.slug)}`;
      await sendCatalogRequest<ManagedCategory>(path, isNew ? "POST" : "PUT", draft);
      setEditor(null);
      setNotice(isNew ? "Category created. It is now available when adding products." : "Category changes saved in DynamoDB.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: ManagedCategory) {
    if (!window.confirm(`Permanently delete category “${category.name}”? This is only allowed when it contains no products.`)) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await sendCatalogRequest(`/api/admin/categories/${encodeURIComponent(category.slug)}`, "DELETE", { expectedRevision: category.revision });
      await refresh();
      setNotice(`Deleted ${category.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete category.");
    } finally {
      setBusy(false);
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    setError("");
    try { await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh categories."); }
    finally { setRefreshing(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-moss">Catalogue</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Category management</h1>
          <p className="mt-2 text-sm text-slate-600">Category names and descriptions update across the storefront.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => { setEditor({ mode: "create" }); setNotice(""); setError(""); }} className="rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white hover:bg-moss/90">Add category</button>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {editor && <CategoryForm key={editor.mode === "create" ? "new" : editor.category.slug} initial={editor.mode === "edit" ? editor.category : null} busy={busy} onSave={save} onCancel={() => setEditor(null)} />}
      <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-[200px] max-w-sm flex-1 space-y-1 text-xs font-medium text-slate-600">Search categories
            <input className={inputClass} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or slug" />
          </label>
          <button type="button" onClick={() => void manualRefresh()} disabled={busy || refreshing} className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper">{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
        <p className="text-xs text-slate-500">{filtered.length} categories shown; deletion is blocked when products still belong to a category.</p>
        {filtered.length === 0 ? <p className="rounded-lg bg-paper px-4 py-8 text-center text-sm text-slate-600">No categories found.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[610px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-slate-500"><th className="py-3 pr-4 font-medium">Category</th><th className="py-3 pr-4 font-medium">Description</th><th className="py-3 pr-4 text-right font-medium">Products</th><th className="py-3 text-right font-medium">Actions</th></tr></thead>
              <tbody>{filtered.map((category) => {
                const count = productCounts.get(category.slug) ?? 0;
                return <tr key={category.slug} className="border-b border-line last:border-0">
                  <td className="py-4 pr-4"><p className="font-medium">{category.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{category.slug}</p></td>
                  <td className="max-w-[350px] py-4 pr-4 text-slate-600">{category.description}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{count}</td>
                  <td className="py-4 text-right"><div className="flex justify-end gap-3">
                    <button type="button" disabled={busy} className="font-medium text-moss hover:underline" onClick={() => { setEditor({ mode: "edit", category }); setNotice(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                    <button type="button" disabled={busy || count > 0} title={count > 0 ? "Move or delete this category's products first" : "Delete category"} className="font-medium text-red-700 hover:underline disabled:opacity-40" onClick={() => void remove(category)}>Delete</button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
