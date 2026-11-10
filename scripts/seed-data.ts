import type { Category, Product } from "@/types";

const productImage = (id: string) => `/images/products/${id}${id === "canvas-daypack" ? ".png" : ".jpg"}`;
const categoryImage = (slug: string) => `/images/categories/${slug}${slug === "carry" ? ".png" : ".jpg"}`;

export const categories: Category[] = [
  { slug: "desk", name: "Desk & Studio", description: "Tools for focused work: lamps, organisers, notebooks.", image: categoryImage("desk") },
  { slug: "kitchen", name: "Kitchen", description: "Cookware and serving pieces built for daily use.", image: categoryImage("kitchen") },
  { slug: "living", name: "Living", description: "Textiles, candles and objects that make a room feel lived in.", image: categoryImage("living") },
  { slug: "carry", name: "Carry", description: "Bags and pouches that hold up to a commute.", image: categoryImage("carry") },
];

type Seed = Omit<Product, "createdAt" | "images">;

const raw: Seed[] = [
  { id: "arc-desk-lamp", name: "Arc Desk Lamp", categorySlug: "desk", priceCents: 8900, stock: 25, rating: 4.7, tags: ["lighting", "metal", "work"], description: "Dimmable LED lamp with a weighted base and a 40 cm adjustable arm. Warm light, no flicker." },
  { id: "slate-desk-tray", name: "Slate Desk Tray", categorySlug: "desk", priceCents: 3400, stock: 40, rating: 4.4, tags: ["storage", "stone", "work"], description: "Hand-finished slate tray for pens, cables and keys. Felt underside protects the desk." },
  { id: "grid-notebook-set", name: "Grid Notebook Set", categorySlug: "desk", priceCents: 2200, stock: 120, rating: 4.6, tags: ["paper", "writing", "work"], description: "Three A5 notebooks with lay-flat binding and 100 gsm paper that handles fountain pens." },
  { id: "oak-monitor-riser", name: "Oak Monitor Riser", categorySlug: "desk", priceCents: 6400, stock: 12, rating: 4.5, tags: ["wood", "storage", "work"], description: "Solid oak riser that lifts your screen to eye level and hides a keyboard underneath." },
  { id: "cast-iron-skillet", name: "Cast Iron Skillet", categorySlug: "kitchen", priceCents: 5200, stock: 30, rating: 4.9, tags: ["cookware", "metal", "cooking"], description: "26 cm pre-seasoned skillet. Goes from stovetop to oven to table and gets better with use." },
  { id: "ceramic-pour-over", name: "Ceramic Pour-Over Set", categorySlug: "kitchen", priceCents: 4600, stock: 18, rating: 4.6, tags: ["coffee", "ceramic", "cooking"], description: "Dripper and carafe in matte glaze. Makes up to four cups with a clean, bright flavour." },
  { id: "olive-wood-board", name: "Olive Wood Board", categorySlug: "kitchen", priceCents: 3900, stock: 0, rating: 4.3, tags: ["wood", "serving", "cooking"], description: "Each board is cut from a single piece of olive wood, so no two grain patterns match." },
  { id: "stoneware-bowl-trio", name: "Stoneware Bowl Trio", categorySlug: "kitchen", priceCents: 4200, stock: 22, rating: 4.5, tags: ["ceramic", "serving", "cooking"], description: "Three nesting bowls in a speckled glaze. Dishwasher and microwave safe." },
  { id: "linen-throw", name: "Washed Linen Throw", categorySlug: "living", priceCents: 7800, stock: 16, rating: 4.8, tags: ["textile", "linen", "home"], description: "Stone-washed linen that is soft from day one. 130 x 180 cm with a hand-knotted fringe." },
  { id: "soy-candle", name: "Cedar & Fig Soy Candle", categorySlug: "living", priceCents: 2800, stock: 60, rating: 4.4, tags: ["candle", "scent", "home"], description: "Hand-poured soy wax in a reusable glass jar. About 45 hours of burn time." },
  { id: "terracotta-vase", name: "Fluted Terracotta Vase", categorySlug: "living", priceCents: 3600, stock: 14, rating: 4.2, tags: ["ceramic", "decor", "home"], description: "Unglazed terracotta with a fluted body. Works with dried stems or a glass liner for fresh flowers." },
  { id: "wool-cushion", name: "Wool Cushion Cover", categorySlug: "living", priceCents: 3100, stock: 35, rating: 4.1, tags: ["textile", "wool", "home"], description: "Woven lambswool cover, 50 x 50 cm, with a hidden zip. Insert sold separately." },
  { id: "canvas-daypack", name: "Waxed Canvas Daypack", categorySlug: "carry", priceCents: 12900, stock: 9, rating: 4.7, tags: ["bag", "canvas", "travel"], description: "Water-resistant waxed canvas with a padded 15 inch laptop sleeve and leather trims." },
  { id: "leather-pouch", name: "Leather Zip Pouch", categorySlug: "carry", priceCents: 3800, stock: 50, rating: 4.5, tags: ["leather", "storage", "travel"], description: "Vegetable-tanned leather pouch for cables, cards or cosmetics. Develops a patina over time." },
  { id: "market-tote", name: "Market Tote", categorySlug: "carry", priceCents: 2400, stock: 80, rating: 4.3, tags: ["bag", "canvas", "travel"], description: "Heavy organic cotton tote with reinforced handles that carry up to 15 kg." },
  { id: "steel-bottle", name: "Insulated Steel Bottle", categorySlug: "carry", priceCents: 3200, stock: 70, rating: 4.6, tags: ["steel", "travel", "coffee"], description: "750 ml double-wall bottle that keeps drinks cold for 24 hours or hot for 12." },
];

export const products: Product[] = raw.map((p, i) => ({
  ...p,
  images: [productImage(p.id)],
  createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
}));
