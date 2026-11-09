export interface Category {
  slug: string;
  name: string;
  description: string;
  image: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  /** Price in cents to avoid floating-point errors */
  priceCents: number;
  categorySlug: string;
  images: string[];
  stock: number;
  rating: number;
  tags: string[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemRecord {
  userId: string;
  productId: string;
  quantity: number;
  addedAt: string;
  /** Optimistic-lock version. Legacy cart records may not have this field yet. */
  version?: number;
}

export interface CartLine {
  product: Product;
  quantity: number;
  lineTotalCents: number;
}

export interface Cart {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
}

export interface WishlistItemRecord {
  userId: string;
  productId: string;
  addedAt: string;
}

export type SortOption = "newest" | "price-asc" | "price-desc" | "rating";

export interface ProductQuery {
  q?: string;
  category?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: SortOption;
}
