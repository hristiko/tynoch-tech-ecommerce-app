import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CatalogError,
  belongsToCategory,
  hasProductReference,
  isSlug,
  parseCategoryDraft,
  parseProductDraft,
  revisionCondition,
} from "../src/lib/catalog-model.ts";
import { currencyToCents } from "../src/components/catalog-ui.ts";

const product = {
  id: "office-lamp",
  name: "Office Lamp",
  description: "A dimmable lamp for small desks",
  priceCents: 2950,
  stock: 5,
  rating: 4.5,
  categorySlug: "desk",
  images: ["/images/products/office-lamp.jpg"],
  tags: ["lighting", "work"],
};
const category = {
  slug: "desk",
  name: "Desk and Studio",
  description: "Tools for focused work",
  image: "/images/categories/desk.jpg",
};

describe("catalogue input validation", () => {
  it("accepts a normal product and category", () => {
    assert.equal(parseProductDraft(product, "create").priceCents, 2950);
    assert.equal(parseCategoryDraft(category, "create").slug, "desk");
  });
  it("requires a revision when editing existing data", () => {
    assert.throws(() => parseProductDraft(product, "update"), CatalogError);
    assert.throws(() => parseCategoryDraft(category, "update"), CatalogError);
    assert.equal(parseProductDraft({ ...product, expectedRevision: 0 }, "update").expectedRevision, 0);
  });
  it("rejects invalid prices, stock, and ratings", () => {
    for (const bad of [-1, 1.234, Number.NaN, "10", 100_000_000]) {
      assert.throws(() => parseProductDraft({ ...product, priceCents: bad }, "create"), CatalogError);
    }
    assert.throws(() => parseProductDraft({ ...product, stock: -1 }, "create"), CatalogError);
    assert.throws(() => parseProductDraft({ ...product, rating: 5.1 }, "create"), CatalogError);
  });
  it("prevents malformed IDs and unsafe image paths", () => {
    assert.equal(isSlug("arc-desk-lamp"), true);
    assert.equal(isSlug("../../admin"), false);
    assert.throws(() => parseProductDraft({ ...product, id: "../../admin" }, "create"), CatalogError);
    assert.throws(() => parseProductDraft({ ...product, images: ["https://example.com/pixel.jpg"] }, "create"), CatalogError);
    assert.throws(() => parseCategoryDraft({ ...category, image: "/images/products/office-lamp.jpg" }, "create"), CatalogError);
  });
  it("normalizes tags and rejects duplicates", () => {
    assert.deepEqual(parseProductDraft({ ...product, tags: [" HOME ", "desk"] }, "create").tags, ["home", "desk"]);
    assert.throws(() => parseProductDraft({ ...product, tags: ["Desk", "desk"] }, "create"), CatalogError);
  });
});

describe("catalogue reference and concurrency rules", () => {
  it("matches only real cart/wishlist item keys", () => {
    assert.equal(hasProductReference({ PK: "USER#acct-abc", SK: "CART#office-lamp" }, "office-lamp"), true);
    assert.equal(hasProductReference({ PK: "USER#acct-abc", SK: "WISHLIST#office-lamp" }, "office-lamp"), true);
    assert.equal(hasProductReference({ PK: "ORDER#abc", SK: "CART#office-lamp" }, "office-lamp"), false);
    assert.equal(hasProductReference({ PK: "USER#acct-abc", SK: "CART#other" }, "office-lamp"), false);
  });
  it("matches product category dependencies", () => {
    assert.equal(belongsToCategory({ PK: "PRODUCT#office-lamp", SK: "METADATA", categorySlug: "desk" }, "desk"), true);
    assert.equal(belongsToCategory({ PK: "ORDER#office-lamp", SK: "METADATA", categorySlug: "desk" }, "desk"), false);
  });
  it("uses a missing-version condition for seed records", () => {
    assert.equal(revisionCondition(0), "attribute_not_exists(revision)");
    assert.equal(revisionCondition(3), "revision = :expectedRevision");
  });
  it("converts exact euro amounts to cents", () => {
    assert.equal(currencyToCents("19.90"), 1990);
    assert.equal(currencyToCents("3,5"), 350);
    assert.throws(() => currencyToCents("3.999"));
    assert.throws(() => currencyToCents("-2"));
  });
});
