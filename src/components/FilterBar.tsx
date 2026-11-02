import Link from "next/link";
import type { Category } from "@/types";

interface Props {
  categories: Category[];
  values: { q?: string; category?: string; min?: string; max?: string; sort?: string };
}

/** Plain GET form: works without JavaScript and keeps filters in the URL (shareable, back-button friendly). */
export default function FilterBar({ categories, values }: Props) {
  const active = Object.values(values).some(Boolean);
  return (
    <form action="/products" className="grid grid-cols-2 gap-3 rounded-lg border border-ink/10 bg-white p-4 md:grid-cols-6">
      <div className="col-span-2 md:col-span-2">
        <label htmlFor="f-q" className="mb-1 block text-sm font-medium">Search</label>
        <input id="f-q" name="q" type="search" defaultValue={values.q} maxLength={80} placeholder="Lamp, linen, steel…" className="field" />
      </div>
      <div>
        <label htmlFor="f-cat" className="mb-1 block text-sm font-medium">Category</label>
        <select id="f-cat" name="category" defaultValue={values.category ?? ""} className="field">
          <option value="">All</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-sort" className="mb-1 block text-sm font-medium">Sort</label>
        <select id="f-sort" name="sort" defaultValue={values.sort ?? "newest"} className="field">
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-min" className="mb-1 block text-sm font-medium">Min €</label>
        <input id="f-min" name="min" type="number" min={0} step="1" defaultValue={values.min} className="field" />
      </div>
      <div>
        <label htmlFor="f-max" className="mb-1 block text-sm font-medium">Max €</label>
        <input id="f-max" name="max" type="number" min={0} step="1" defaultValue={values.max} className="field" />
      </div>
      <div className="col-span-2 flex items-center gap-3 md:col-span-6">
        <button type="submit" className="btn-primary">Apply filters</button>
        {active && <Link href="/products" className="text-sm font-medium text-cobalt hover:underline">Clear all</Link>}
      </div>
    </form>
  );
}
