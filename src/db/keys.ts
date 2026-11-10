export const keys = {
  product: (id: string) => ({ PK: `PRODUCT#${id}`, SK: "METADATA" }),
  category: (slug: string) => ({ PK: `CATEGORY#${slug}`, SK: "METADATA" }),
  user: (id: string) => ({ PK: `USER#${id}`, SK: "PROFILE" }),
  userCredentials: (id: string) => ({ PK: `USER#${id}`, SK: "CREDENTIALS" }),
  cartItem: (userId: string, productId: string) => ({ PK: `USER#${userId}`, SK: `CART#${productId}` }),
  wishlistItem: (userId: string, productId: string) => ({ PK: `USER#${userId}`, SK: `WISHLIST#${productId}` }),
};

export const prefixes = { cart: "CART#", wishlist: "WISHLIST#" };

export const INDEX = { byCategory: "GSI1", byType: "GSI2" } as const;

export function stripKeys<T extends Record<string, unknown>>(item: T) {
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, entityType, ...rest } = item as Record<string, unknown>;
  void PK; void SK; void GSI1PK; void GSI1SK; void GSI2PK; void GSI2SK; void entityType;
  return rest;
}
