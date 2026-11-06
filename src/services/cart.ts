import { cartRepo } from "@/db/repositories/cart";
import { productRepo } from "@/db/repositories/products";
import { userRepo } from "@/db/repositories/users";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { buildCart, clampQuantity, mergeQuantity } from "./cartLogic";
import type { Cart } from "@/types";

export const cartService = {
  async get(userId: string): Promise<Cart> {
    const items = await cartRepo.list(userId);
    const products = await productRepo.getMany(items.map((i) => i.productId));
    return buildCart(items, products);
  },

  async count(userId: string): Promise<number> {
    return (await this.get(userId)).itemCount;
  },

  async add(userId: string, productId: string, quantity: number): Promise<Cart> {
    const product = await productRepo.getById(productId);
    if (!product) throw new NotFoundError("Product not found");
    if (product.stock < 1) throw new ConflictError("This product is out of stock");
    await userRepo.ensure(userId);
    const existing = await cartRepo.get(userId, productId);
    await cartRepo.upsert({
      userId,
      productId,
      quantity: mergeQuantity(existing?.quantity, quantity, product.stock),
      addedAt: existing?.addedAt ?? new Date().toISOString(),
    });
    return this.get(userId);
  },

  async setQuantity(userId: string, productId: string, quantity: number): Promise<Cart> {
    const existing = await cartRepo.get(userId, productId);
    if (!existing) throw new NotFoundError("Item is not in your cart");
    const product = await productRepo.getById(productId);
    if (!product) {
      await cartRepo.remove(userId, productId);
      throw new NotFoundError("Product is no longer available");
    }
    if (product.stock < 1) throw new ConflictError("This product is out of stock");
    await cartRepo.upsert({ ...existing, quantity: clampQuantity(quantity, product.stock) });
    return this.get(userId);
  },

  async remove(userId: string, productId: string): Promise<Cart> {
    await cartRepo.remove(userId, productId); // idempotent
    return this.get(userId);
  },
};
