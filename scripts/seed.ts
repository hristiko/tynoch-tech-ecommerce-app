import "./load-env";
import { categoryRepo } from "@/db/repositories/categories";
import { productRepo } from "@/db/repositories/products";
import { categories, products } from "./seed-data";

async function main() {
  for (const c of categories) await categoryRepo.put(c);
  console.log(`Seeded ${categories.length} categories`);
  for (const p of products) await productRepo.put(p);
  console.log(`Seeded ${products.length} products`);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
