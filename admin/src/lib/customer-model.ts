import { ACCOUNT_ID } from "./role";

export type ShopperKind = "registered" | "guest" | "orphaned";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "customer";
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingOwner {
  userId: string;
  name: string;
  email: string;
  kind: ShopperKind;
  cartLines: number;
  cartQuantity: number;
  wishlistItems: number;
}

export interface ShoppingLine {
  productId: string;
  productName: string;
  priceCents: number | null;
  stock: number | null;
  quantity: number;
  addedAt: string;
  version: number | null;
}

export interface WishLine {
  productId: string;
  productName: string;
  priceCents: number | null;
  stock: number | null;
  addedAt: string;
}

export interface ShoppingDetails {
  owner: ShoppingOwner;
  cart: ShoppingLine[];
  wishlist: WishLine[];
  cartSubtotalCents: number;
}

export interface ManagedUserDetails {
  user: ManagedUser;
  shopping: ShoppingDetails;
}

export interface AccountUpdate {
  name: string;
  expectedUpdatedAt: string;
}

export interface AccountDeletion {
  expectedUpdatedAt: string;
  confirmEmail: string;
}

export type ShoppingKind = "cart" | "wishlist";
export type ShoppingRemoval =
  | { kind: "cart"; expectedVersion: number | null; expectedQuantity: number }
  | { kind: "wishlist"; expectedAddedAt: string };

export class CustomerError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "CustomerError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(record).some(key => !keys.includes(key))) {
    throw new CustomerError("This operation contains unsupported fields.", 400);
  }
}

function asTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new CustomerError(`${label} is required. Reload the page and try again.`, 400);
  }
  return value;
}

export function isAccountId(value: string): boolean {
  return ACCOUNT_ID.test(value);
}

export function isShopperId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{5,95}$/i.test(value);
}

export function isProductId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;
}

export function asRegisteredUser(item: unknown): ManagedUser | null {
  if (!isRecord(item) || item.accountType !== "registered" || item.SK !== "PROFILE") return null;
  if (typeof item.id !== "string" || !isAccountId(item.id) || item.PK !== `USER#${item.id}`) return null;
  if (typeof item.email !== "string" || !item.email || typeof item.name !== "string") return null;
  return {
    id: item.id,
    email: item.email,
    name: item.name,
    role: item.role === "admin" ? "admin" : "customer",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

export function parseAccountUpdate(value: unknown): AccountUpdate {
  if (!isRecord(value)) throw new CustomerError("Expected a JSON object.", 400);
  exactKeys(value, ["name", "expectedUpdatedAt"]);
  if (typeof value.name !== "string" || value.name.trim().length < 2 || value.name.trim().length > 100) {
    throw new CustomerError("Display name must contain between 2 and 100 characters.", 400);
  }
  return { name: value.name.trim(), expectedUpdatedAt: asTimestamp(value.expectedUpdatedAt, "Account revision") };
}

export function parseAccountDeletion(value: unknown): AccountDeletion {
  if (!isRecord(value)) throw new CustomerError("Expected a JSON object.", 400);
  exactKeys(value, ["expectedUpdatedAt", "confirmEmail"]);
  if (typeof value.confirmEmail !== "string" || !value.confirmEmail.trim()) throw new CustomerError("Confirm the account email before deletion.", 400);
  return { expectedUpdatedAt: asTimestamp(value.expectedUpdatedAt, "Account revision"), confirmEmail: value.confirmEmail.trim().toLowerCase() };
}

export function parseShoppingRemoval(kind: string, value: unknown): ShoppingRemoval {
  if (!isRecord(value)) throw new CustomerError("Expected a JSON object.", 400);
  if (kind === "cart") {
    exactKeys(value, ["expectedVersion", "expectedQuantity"]);
    const validVersion = value.expectedVersion === null || (Number.isSafeInteger(value.expectedVersion) && (value.expectedVersion as number) >= 0);
    if (!validVersion || !Number.isSafeInteger(value.expectedQuantity) || (value.expectedQuantity as number) < 1) {
      throw new CustomerError("Invalid cart revision. Reload the cart and try again.", 400);
    }
    return { kind: "cart", expectedVersion: value.expectedVersion as number | null, expectedQuantity: value.expectedQuantity as number };
  }
  if (kind === "wishlist") {
    exactKeys(value, ["expectedAddedAt"]);
    return { kind: "wishlist", expectedAddedAt: asTimestamp(value.expectedAddedAt, "Wishlist revision") };
  }
  throw new CustomerError("Invalid shopping record type.", 400);
}

export function accountDeletionAllowed(targetId: string, actorId: string, role: ManagedUser["role"]): boolean {
  return isAccountId(targetId) && targetId !== actorId && role !== "admin";
}

export function summarizeShoppingOwners(items: Record<string, unknown>[]): ShoppingOwner[] {
  const owners = new Map<string, ShoppingOwner>();
  for (const item of items) {
    if (typeof item.PK !== "string" || !item.PK.startsWith("USER#") || typeof item.SK !== "string") continue;
    const userId = item.PK.slice(5);
    if (!isShopperId(userId)) continue;
    let owner = owners.get(userId);
    if (!owner) {
      owner = { userId, name: "", email: "", kind: isAccountId(userId) ? "orphaned" : "guest", cartLines: 0, cartQuantity: 0, wishlistItems: 0 };
      owners.set(userId, owner);
    }
    if (item.SK === "PROFILE") {
      owner.name = typeof item.name === "string" ? item.name : "";
      owner.email = item.accountType === "registered" && typeof item.email === "string" ? item.email : "";
      owner.kind = item.accountType === "registered" ? "registered" : "guest";
    } else if (item.SK.startsWith("CART#")) {
      owner.cartLines++;
      if (typeof item.quantity === "number" && Number.isSafeInteger(item.quantity) && item.quantity > 0) owner.cartQuantity += item.quantity;
    } else if (item.SK.startsWith("WISHLIST#")) {
      owner.wishlistItems++;
    }
  }
  return [...owners.values()].filter(owner => owner.cartLines > 0 || owner.wishlistItems > 0)
    .sort((a, b) => (b.cartLines + b.wishlistItems) - (a.cartLines + a.wishlistItems) || a.userId.localeCompare(b.userId));
}

export function ownerLabel(owner: ShoppingOwner): string {
  if (owner.name.trim()) return owner.name;
  if (owner.kind === "guest") return `Guest ${owner.userId.slice(-8)}`;
  return `Account ${owner.userId.slice(-8)}`;
}
