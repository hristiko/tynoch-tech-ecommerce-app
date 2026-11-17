import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { adminDb, adminTable } from "../src/lib/db";
import { createCategory, createProduct, deleteCategory, deleteProduct, getCategory, getProduct, updateCategory, updateProduct } from "../src/lib/catalog-db";
import { CatalogError, parseCategoryDraft, parseProductDraft } from "../src/lib/catalog-model";

const endpoint = process.env.DYNAMODB_ENDPOINT ?? "";
if (!/^http:\/\/(localhost|127\.0\.0\.1):8000\/?$/.test(endpoint)) {
  throw new Error("Refusing catalogue integration tests outside local DynamoDB at http://localhost:8000.");
}

const suffix = randomUUID().slice(0, 8);
const categorySlug = `stage3-${suffix}`;
const productId = `stage3-item-${suffix}`;
const tempUserId = `stage3-temporary-${suffix}`;
const referenceKey = { PK: `USER#${tempUserId}`, SK: `CART#${productId}` };
const categoryDraft = {
  slug: categorySlug,
  name: `Test category ${suffix}`,
  description: "Disposable test category for the CRUD check",
  image: "/images/categories/desk.jpg",
};
const productDraft = {
  id: productId,
  name: `Test product ${suffix}`,
  description: "Disposable test product for a local CRUD check",
  categorySlug,
  priceCents: 1599,
  stock: 4,
  rating: 4.3,
  tags: ["testing"],
  images: ["/images/products/arc-desk-lamp.jpg"],
};

let createdCategory = false;
let createdProduct = false;
let createdReference = false;

async function expectConflict(operation: () => Promise<unknown>, message: string) {
  await assert.rejects(operation, (error: unknown) => error instanceof CatalogError && error.status === 409, message);
}

async function main() {
  try {
    console.log(`Database: ${endpoint}; table: ${adminTable}`);
    await createCategory(parseCategoryDraft(categoryDraft, "create"));
    createdCategory = true;
    console.log("PASS: Created temporary category.");

    const product = await createProduct(parseProductDraft(productDraft, "create"));
    createdProduct = true;
    assert.equal(product.stock, 4);
    assert.equal((await getProduct(productId))?.priceCents, 1599);
    console.log("PASS: Created product that is readable through the same DynamoDB table.");

    await expectConflict(() => createProduct(parseProductDraft(productDraft, "create")), "Duplicate product must be rejected");
    console.log("PASS: Duplicate product ID blocked.");

    const updated = await updateProduct(productId, parseProductDraft({ ...productDraft, priceCents: 1799, stock: 2, expectedRevision: product.revision }, "update"));
    assert.equal(updated.priceCents, 1799);
    assert.equal(updated.stock, 2);
    console.log("PASS: Updated price and stock.");

    await expectConflict(() => updateProduct(productId, parseProductDraft({ ...productDraft, expectedRevision: product.revision }, "update")), "Stale edits must be rejected");
    console.log("PASS: Stale edits blocked.");

    await expectConflict(() => deleteCategory(categorySlug, 1), "Cannot delete a category still containing products");
    console.log("PASS: Category deletion blocked while product exists.");

    await adminDb.send(new PutCommand({
      TableName: adminTable,
      Item: { ...referenceKey, entityType: "CART_ITEM", productId, userId: tempUserId, quantity: 1, addedAt: new Date().toISOString() },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    createdReference = true;
    await expectConflict(() => deleteProduct(productId, updated.revision), "Product in cart must not be deleted");
    console.log("PASS: Product deletion blocked while referenced in cart.");

    await adminDb.send(new DeleteCommand({ TableName: adminTable, Key: referenceKey }));
    createdReference = false;
    await deleteProduct(productId, updated.revision);
    createdProduct = false;
    assert.equal(await getProduct(productId), null);
    console.log("PASS: Removed unreferenced temporary product.");

    const category = await getCategory(categorySlug);
    assert.ok(category);
    const renamed = await updateCategory(categorySlug, parseCategoryDraft({ ...categoryDraft, name: "Renamed test category", expectedRevision: category.revision }, "update"));
    assert.equal(renamed.name, "Renamed test category");
    await deleteCategory(categorySlug, renamed.revision);
    createdCategory = false;
    console.log("PASS: Updated and deleted empty category.");
    console.log("PASS: Temporary test records cleaned up. No existing catalogue data changed.");
  } finally {
    if (createdReference) await adminDb.send(new DeleteCommand({ TableName: adminTable, Key: referenceKey }));
    if (createdProduct) await adminDb.send(new DeleteCommand({ TableName: adminTable, Key: { PK: `PRODUCT#${productId}`, SK: "METADATA" } }));
    if (createdCategory) await adminDb.send(new DeleteCommand({ TableName: adminTable, Key: { PK: `CATEGORY#${categorySlug}`, SK: "METADATA" } }));
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
