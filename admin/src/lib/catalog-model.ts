export interface ManagedCategory {
  slug: string;
  name: string;
  description: string;
  image: string;
  revision: number;
}

export interface ManagedProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  categorySlug: string;
  images: string[];
  stock: number;
  rating: number;
  tags: string[];
  createdAt: string;
  revision: number;
}

export type ProductDraft = Omit<ManagedProduct, "createdAt" | "revision"> & { expectedRevision?: number };
export type CategoryDraft = Omit<ManagedCategory, "revision"> & { expectedRevision?: number };

export class CatalogError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "CatalogError";
  }
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imagePattern = /^\/images\/(?:products|categories)\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/i;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogError("Expected an object.", 400);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new CatalogError(`${label} is required.`, 400);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new CatalogError(`${label} must contain ${min}–${max} characters.`, 400);
  return text;
}

function slug(value: unknown, label: string, max = 64): string {
  const text = string(value, label, 2, max);
  if (!slugPattern.test(text)) throw new CatalogError(`${label} must use lowercase letters, numbers and single hyphens.`, 400);
  return text;
}

function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new CatalogError(`${label} must be a whole number between ${min} and ${max}.`, 400);
  }
  return value;
}

function revision(value: unknown): number | undefined {
  return value === undefined ? undefined : integer(value, "Revision", 0, 2_000_000_000);
}

function imagePath(value: unknown, label: string, directory: "products" | "categories"): string {
  const path = string(value, label, 16, 240);
  if (!imagePattern.test(path) || !path.startsWith(`/images/${directory}/`)) {
    throw new CatalogError(`${label} must be a local /images/${directory}/ JPG, PNG or WebP path.`, 400);
  }
  return path;
}

export function parseProductDraft(input: unknown, mode: "create" | "update"): ProductDraft {
  const record = object(input);
  const id = slug(record.id, "Product ID");
  const name = string(record.name, "Product name", 2, 120);
  const description = string(record.description, "Description", 8, 2000);
  const priceCents = integer(record.priceCents, "Price in cents", 0, 99_999_999);
  const categorySlug = slug(record.categorySlug, "Category slug", 60);
  const stock = integer(record.stock, "Stock", 0, 100_000);
  if (typeof record.rating !== "number" || !Number.isFinite(record.rating) || record.rating < 0 || record.rating > 5) {
    throw new CatalogError("Rating must be between 0 and 5.", 400);
  }
  if (!Array.isArray(record.images) || record.images.length < 1 || record.images.length > 5) {
    throw new CatalogError("Choose between 1 and 5 product images.", 400);
  }
  const images = record.images.map((value) => imagePath(value, "Product image", "products"));
  if (!Array.isArray(record.tags) || record.tags.length > 12) {
    throw new CatalogError("Enter up to 12 tags.", 400);
  }
  const tags = record.tags.map((value) => string(value, "Tag", 1, 32).toLowerCase());
  if (new Set(tags).size !== tags.length) throw new CatalogError("Tags must not contain duplicates.", 400);
  const expectedRevision = revision(record.expectedRevision);
  if (mode === "update" && expectedRevision === undefined) throw new CatalogError("Revision is required. Reload the page and try again.", 400);
  return { id, name, description, priceCents, categorySlug, stock, rating: record.rating, images, tags, expectedRevision };
}

export function parseCategoryDraft(input: unknown, mode: "create" | "update"): CategoryDraft {
  const record = object(input);
  const slugValue = slug(record.slug, "Category slug", 60);
  const name = string(record.name, "Category name", 2, 80);
  const description = string(record.description, "Description", 8, 500);
  const image = imagePath(record.image, "Category image", "categories");
  const expectedRevision = revision(record.expectedRevision);
  if (mode === "update" && expectedRevision === undefined) throw new CatalogError("Revision is required. Reload the page and try again.", 400);
  return { slug: slugValue, name, description, image, expectedRevision };
}

export function isSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 64 && slugPattern.test(value);
}

export function revisionCondition(expectedRevision: number) {
  return expectedRevision === 0 ? "attribute_not_exists(revision)" : "revision = :expectedRevision";
}

export function hasProductReference(item: Record<string, unknown>, productId: string): boolean {
  const pk = item.PK;
  const sk = item.SK;
  return typeof pk === "string" && pk.startsWith("USER#") && (sk === `CART#${productId}` || sk === `WISHLIST#${productId}`);
}

export function belongsToCategory(item: Record<string, unknown>, categorySlug: string): boolean {
  return typeof item.PK === "string" && item.PK.startsWith("PRODUCT#") && item.SK === "METADATA" && item.categorySlug === categorySlug;
}
