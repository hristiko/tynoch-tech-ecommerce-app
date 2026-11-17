"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ManagedCategory, ManagedProduct, ProductDraft } from "@/lib/catalog-model";
import { currencyToCents, euros, fetchCatalog, sendCatalogRequest } from "./catalog-ui";

const inputClass = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-moss";
const pageSize = 8;

type Editor = { mode: "create" } | { mode: "edit"; product: ManagedProduct } | null;

function ProductForm({
  initial,
  categories,
  busy,
  onSave,
  onCancel,
}: {
  initial: ManagedProduct | null;
  categories: ManagedCategory[];
  busy: boolean;
  onSave: (value: ProductDraft, isNew: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [id, setId] = useState(initial?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? (initial.priceCents / 100).toFixed(2) : "");
  const [stock, setStock] = useState(initial?.stock.toString() ?? "0");
  const [rating, setRating] = useState(initial?.rating.toString() ?? "4.5");
  const [categorySlug, setCategorySlug] = useState(initial?.categorySlug ?? categories[0]?.slug ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [images, setImages] = useState(initial?.images.join("\n") ?? "");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const value: ProductDraft = {
        id: id.trim(),
        name: name.trim(),
        description: description.trim(),
        priceCents: currencyToCents(price),
        stock: Number(stock),
        rating: Number(rating),
        categorySlug,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        images: images.split(/\r?\n/).map((image) => image.trim()).filter(Boolean),
        ...(initial ? { expectedRevision: initial.revision } : {}),
      };
      await onSave(value, initial === null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save product.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{initial ? `Edit ${initial.name}` : "Add a product"}</h2>
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm font-medium text-slate-600 hover:underline">Cancel</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-medium">Product ID
          <input required className={inputClass} value={id} onChange={(event) => setId(event.target.value)} disabled={busy || !!initial} placeholder="e.g. desk-organizer" maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          <span className="block text-xs font-normal text-slate-500">Permanent URL identifier; lowercase letters, digits and hyphens</span>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Name
          <input required className={inputClass} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} maxLength={120} minLength={2} />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Price (EUR)
          <input required className={inputClass} value={price} onChange={(event) => setPrice(event.target.value)} disabled={busy} inputMode="decimal" placeholder="29.90" />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Category
          <select required value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)} disabled={busy} className={inputClass}>
            {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Stock
          <input required className={inputClass} value={stock} onChange={(event) => setStock(event.target.value)} disabled={busy} type="number" step="1" min="0" max="100000" />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">Rating (0–5)
          <input required className={inputClass} value={rating} onChange={(event) => setRating(event.target.value)} disabled={busy} type="number" min="0" max="5" step="0.1" />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">Description
        <textarea required className={inputClass} rows={3} minLength={8} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">Tags (comma-separated)
        <input className={inputClass} value={tags} onChange={(event) => setTags(event.target.value)} disabled={busy} placeholder="home, wood, storage" />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">Product image paths (one per line)
        <textarea required className={inputClass} rows={2} value={images} onChange={(event) => setImages(event.target.value)} disabled={busy} placeholder="/images/products/my-product.jpg" />
        <span className="block text-xs font-normal leading-5 text-slate-500">Images must already exist in the storefront&apos;s public/images/products folder. This stage manages image references; it does not upload files.</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || categories.length === 0} className="rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white hover:bg-moss/90">
          {busy ? "Saving…" : initial ? "Save changes" : "Create product"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium">Cancel</button>
      </div>
    </form>
  );
}

export function ProductsManager({ initialProducts, initialCategories }: { initialProducts: ManagedProduct[]; initialCategories: ManagedCategory[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Editor>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [nextProducts, nextCategories] = await Promise.all([
      fetchCatalog<ManagedProduct[]>("/api/admin/products"),
      fetchCatalog<ManagedCategory[]>("/api/admin/categories"),
    ]);
    setProducts(nextProducts);
    setCategories(nextCategories);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !editor && !busy) void refresh().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [busy, editor, refresh]);

  const visible = useMemo(() => products.filter((product) => {
    const match = `${product.id} ${product.name} ${product.description} ${product.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase().trim());
    const inCategory = category === "all" || product.categorySlug === category;
    const inStock = stockFilter === "all" || (stockFilter === "out" ? product.stock === 0 : stockFilter === "low" ? product.stock > 0 && product.stock <= 10 : product.stock > 0);
    return match && inCategory && inStock;
  }), [products, query, category, stockFilter]);
  const maxPage = Math.max(1, Math.ceil(visible.length / pageSize));
  const displayedPage = Math.min(page, maxPage);
  const current = visible.slice((displayedPage - 1) * pageSize, displayedPage * pageSize);
  const categoryNames = new Map(categories.map((item) => [item.slug, item.name]));

  async function save(draft: ProductDraft, isNew: boolean) {
    setBusy(true);
    setError("");
    try {
      const path = isNew ? "/api/admin/products" : `/api/admin/products/${encodeURIComponent(draft.id)}`;
      await sendCatalogRequest<ManagedProduct>(path, isNew ? "POST" : "PUT", draft);
      setEditor(null);
      setNotice(isNew ? "Product created. Storefront catalogue will show the new item." : "Product updated. The new details are saved in DynamoDB.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(product: ManagedProduct) {
    if (!window.confirm(`Delete “${product.name}” permanently? This will be blocked if it is referenced in a cart or wishlist.`)) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await sendCatalogRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, "DELETE", { expectedRevision: product.revision });
      await refresh();
      setNotice(`Deleted ${product.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete product.");
    } finally {
      setBusy(false);
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    setError("");
    try { await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh catalogue."); }
    finally { setRefreshing(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-moss">Catalogue</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Product management</h1>
          <p className="mt-2 text-sm text-slate-600">Changes are saved in the same DynamoDB table used by the storefront.</p>
        </div>
        <button type="button" onClick={() => { setEditor({ mode: "create" }); setError(""); setNotice(""); }} disabled={busy || categories.length === 0}
          className="rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white hover:bg-moss/90">Add product</button>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {editor && (
        <ProductForm key={editor.mode === "create" ? "new" : editor.product.id} initial={editor.mode === "edit" ? editor.product : null}
          categories={categories} busy={busy} onSave={save} onCancel={() => setEditor(null)} />
      )}
      <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1 space-y-1 text-xs font-medium text-slate-600">Search products
            <input className={inputClass} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, tag or ID" />
          </label>
          <label className="min-w-[140px] space-y-1 text-xs font-medium text-slate-600">Category
            <select className={inputClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label className="min-w-[130px] space-y-1 text-xs font-medium text-slate-600">Stock
            <select className={inputClass} value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(1); }}>
              <option value="all">All stock</option><option value="in">In stock</option><option value="low">Low stock (1–10)</option><option value="out">Out of stock</option>
            </select>
          </label>
          <button type="button" onClick={() => void manualRefresh()} disabled={busy || refreshing} className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper">{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
        <p className="text-xs text-slate-500">Showing {visible.length} of {products.length} products. Lists refresh every 15 seconds when you are not editing.</p>
        {visible.length === 0 ? (
          <p className="rounded-lg bg-paper px-4 py-8 text-center text-sm text-slate-600">No products match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[710px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-slate-500">
                <th className="py-3 pr-4 font-medium">Product</th><th className="py-3 pr-4 font-medium">Category</th>
                <th className="py-3 pr-4 text-right font-medium">Price</th><th className="py-3 pr-4 text-right font-medium">Stock</th><th className="py-3 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody>{current.map((product) => (
                <tr key={product.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4"><p className="font-medium">{product.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{product.id}</p></td>
                  <td className="py-3 pr-4">{categoryNames.get(product.categorySlug) ?? product.categorySlug}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{euros(product.priceCents)}</td>
                  <td className={`py-3 pr-4 text-right font-medium tabular-nums ${product.stock === 0 ? "text-red-700" : product.stock <= 10 ? "text-amber-700" : "text-ink"}`}>{product.stock}</td>
                  <td className="py-3 text-right"><div className="flex justify-end gap-3">
                    <button type="button" disabled={busy} className="font-medium text-moss hover:underline" onClick={() => { setEditor({ mode: "edit", product }); setNotice(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                    <button type="button" disabled={busy} className="font-medium text-red-700 hover:underline" onClick={() => void remove(product)}>Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {maxPage > 1 && <div className="flex items-center justify-end gap-3 border-t border-line pt-4 text-sm">
          <button type="button" disabled={displayedPage === 1} onClick={() => setPage(displayedPage - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>Page {displayedPage} of {maxPage}</span>
          <button type="button" disabled={displayedPage === maxPage} onClick={() => setPage(displayedPage + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>}
      </section>
    </div>
  );
}
