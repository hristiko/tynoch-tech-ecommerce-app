import { categoryRepo } from "@/db/repositories/categories";
import { productRepo } from "@/db/repositories/products";
import { NotFoundError } from "@/lib/errors";
import type { Category, Product, ProductQuery } from "@/types";

export function filterAndSort(products: Product[], query: ProductQuery): Product[] {
  const q = query.q?.toLowerCase().trim();
  let result = products.filter((p) => {
    if (q && !`${p.name} ${p.description} ${p.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (query.minPriceCents !== undefined && p.priceCents < query.minPriceCents) return false;
    if (query.maxPriceCents !== undefined && p.priceCents > query.maxPriceCents) return false;
    return true;
  });
  switch (query.sort) {
    case "price-asc": result = [...result].sort((a, b) => a.priceCents - b.priceCents); break;
    case "price-desc": result = [...result].sort((a, b) => b.priceCents - a.priceCents); break;
    case "rating": result = [...result].sort((a, b) => b.rating - a.rating); break;
    default: result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return result;
}

export const catalogService = {
  listCategories: (): Promise<Category[]> => categoryRepo.list(),

  async getCategory(slug: string): Promise<Category> {
    const c = await categoryRepo.getBySlug(slug);
    if (!c) throw new NotFoundError("Category not found");
    return c;
  },

  async searchProducts(query: ProductQuery = {}): Promise<Product[]> {
    const base = query.category ? await productRepo.listByCategory(query.category) : await productRepo.listAll();
    return filterAndSort(base, query);
  },

  async getProduct(id: string): Promise<Product> {
    const p = await productRepo.getById(id);
    if (!p) throw new NotFoundError("Product not found");
    return p;
  },

  async getFeatured(limit = 4): Promise<Product[]> {
    const all = await productRepo.listAll();
    return [...all].sort((a, b) => b.rating - a.rating).slice(0, limit);
  },

  /** Same category first, then shared tags; excludes the product itself. */
  async getRelated(product: Product, limit = 4): Promise<Product[]> {
    const sameCategory = await productRepo.listByCategory(product.categorySlug);
    return sameCategory
      .filter((p) => p.id !== product.id)
      .map((p) => ({ p, score: p.tags.filter((t) => product.tags.includes(t)).length + p.rating / 10 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.p);
  },
};
