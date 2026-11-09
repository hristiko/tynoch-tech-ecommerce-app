/**
 * Single-table key design. See README "DynamoDB design" for the access-pattern table.
 *
 *  Entity     PK                SK                  GSI1 (PK / SK)                 GSI2 (PK / SK)
 *  Product    PRODUCT#<id>      METADATA            CATEGORY#<slug> / <createdAt>  TYPE#PRODUCT / <createdAt>#<id>
 *  Category   CATEGORY#<slug>   METADATA            -                              TYPE#CATEGORY / <name>
 *  User       USER#<id>         PROFILE             -                              -
 *  Cart item  USER#<id>         CART#<productId>    -                              -
 *  Wishlist   USER#<id>         WISHLIST#<productId> -                             -
 */
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

/** Remove DynamoDB key attributes before returning an item to the app. */
export function stripKeys<T extends Record<string, unknown>>(item: T) {
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, entityType, ...rest } = item as Record<string, unknown>;
  void PK; void SK; void GSI1PK; void GSI1SK; void GSI2PK; void GSI2SK; void entityType;
  return rest;
}
