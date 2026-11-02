import { z } from "zod";

export const MAX_QTY_PER_ITEM = 10;

export const productIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/i, "Invalid product id");

export const addToCartSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM).default(1),
});

export const updateCartSchema = z.object({
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

export const wishlistSchema = z.object({ productId: productIdSchema });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
});

const sortValues = ["newest", "price-asc", "price-desc", "rating"] as const;

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(60).optional(),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  sort: z.enum(sortValues).optional(),
});
