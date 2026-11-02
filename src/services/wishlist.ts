import { productRepo } from "@/db/repositories/products";
import { userRepo } from "@/db/repositories/users";
import { wishlistRepo } from "@/db/repositories/wishlist";
import { NotFoundError } from "@/lib/errors";
import type { Product } from "@/types";

export const wishlistService = {
  async getProducts(userId: string): Promise<Product[]> {
    const items = await wishlistRepo.list(userId);
    const products = await productRepo.getMany(items.map((i) => i.productId));
    const order = new Map(items.map((i, idx) => [i.productId, idx]));
    return products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  },

  async getIds(userId: string): Promise<string[]> {
    return (await wishlistRepo.list(userId)).map((i) => i.productId);
  },

  async add(userId: string, productId: string): Promise<{ added: boolean }> {
    if (!(await productRepo.getById(productId))) throw new NotFoundError("Product not found");
    await userRepo.ensure(userId);
    return { added: await wishlistRepo.add(userId, productId) };
  },

  async remove(userId: string, productId: string) {
    await wishlistRepo.remove(userId, productId);
  },
};
