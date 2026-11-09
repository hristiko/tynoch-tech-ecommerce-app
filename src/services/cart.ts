import { cartRepo } from "@/db/repositories/cart";
import { productRepo } from "@/db/repositories/products";
import { userRepo } from "@/db/repositories/users";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { buildCart, clampQuantity, mergeQuantity } from "./cartLogic";
import type { Cart } from "@/types";

const MAX_WRITE_ATTEMPTS = 8;

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

    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const existing = await cartRepo.get(userId, productId);
      const saved = await cartRepo.compareAndPut({
        userId,
        productId,
        quantity: mergeQuantity(existing?.quantity, quantity, product.stock),
        addedAt: existing?.addedAt ?? new Date().toISOString(),
      }, existing);
      if (saved) return this.get(userId);
    }
    throw new ConflictError("Cart changed during this request. Please try again.");
  },

  async setQuantity(userId: string, productId: string, quantity: number): Promise<Cart> {
    const product = await productRepo.getById(productId);
    if (!product) {
      await cartRepo.remove(userId, productId);
      throw new NotFoundError("Product is no longer available");
    }
    if (product.stock < 1) throw new ConflictError("This product is out of stock");

    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const existing = await cartRepo.get(userId, productId);
      if (!existing) throw new NotFoundError("Item is not in your cart");
      const saved = await cartRepo.compareAndPut({
        ...existing,
        quantity: clampQuantity(quantity, product.stock),
      }, existing);
      if (saved) return this.get(userId);
    }
    throw new ConflictError("Cart changed during this request. Please try again.");
  },

  async remove(userId: string, productId: string): Promise<Cart> {
    await cartRepo.remove(userId, productId); // idempotent
    return this.get(userId);
  },
};
