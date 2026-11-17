import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { adminDb, adminTable } from "../src/lib/db";
import {
  deleteRegisteredUser,
  getRegisteredUser,
  getShoppingDetails,
  listRegisteredUsers,
  listShoppingOwners,
  removeShoppingItem,
  updateRegisteredUser,
} from "../src/lib/customer-db";
import { CustomerError } from "../src/lib/customer-model";
import { listProducts } from "../src/lib/catalog-db";

const endpoint = process.env.DYNAMODB_ENDPOINT;
if (!endpoint || !["localhost", "127.0.0.1", "::1"].includes(new URL(endpoint).hostname)) {
  throw new Error("This integration test can run only against local DynamoDB. DYNAMODB_ENDPOINT must point to localhost.");
}

const id = `acct-${randomUUID()}`;
const guestId = `guest-${randomUUID()}`;
const email = `admin-stage4-${randomUUID().slice(0, 10)}@example.invalid`;
const lookupHash = createHash("sha256").update(email).digest("hex");
const lookupKey = { PK: `AUTH_EMAIL#${lookupHash}`, SK: "LOOKUP" };
const key = (userId: string, sk: string) => ({ PK: `USER#${userId}`, SK: sk });
const written: { PK: string; SK: string }[] = [];

async function cleanup() {
  for (const recordKey of written) {
    await adminDb.send(new DeleteCommand({ TableName: adminTable, Key: recordKey })).catch(() => undefined);
  }
}

async function run() {
  const products = await listProducts();
  assert.ok(products.length > 0, "Run db:seed on a new local setup before testing.");
  const productId = products[0].id;
  const now = new Date().toISOString();
  const user = {
    ...key(id, "PROFILE"), entityType: "USER", accountType: "registered", id,
    name: "Stage Four Test", email, createdAt: now, updatedAt: now,
  };
  const credentials = { ...key(id, "CREDENTIALS"), entityType: "CREDENTIALS", passwordHash: "test-only-not-a-valid-password-hash" };
  const lookup = { ...lookupKey, entityType: "AUTH_EMAIL", userId: id };
  const cart = { ...key(id, `CART#${productId}`), entityType: "CART_ITEM", userId: id, productId, quantity: 2, addedAt: now, version: 1 };
  const wish = { ...key(id, `WISHLIST#${productId}`), entityType: "WISHLIST_ITEM", userId: id, productId, addedAt: now };
  for (const record of [user, credentials, lookup, cart, wish]) written.push({ PK: record.PK, SK: record.SK });
  await adminDb.send(new TransactWriteCommand({ TransactItems: [user, credentials, lookup, cart, wish].map(record => ({
    Put: { TableName: adminTable, Item: record, ConditionExpression: "attribute_not_exists(PK)" },
  })) }));

  assert.ok((await listRegisteredUsers()).some(record => record.id === id));
  const detail = await getShoppingDetails(id);
  assert.equal(detail.cart.length, 1);
  assert.equal(detail.cart[0].quantity, 2);
  assert.equal(detail.wishlist.length, 1);
  assert.equal(detail.cartSubtotalCents, 2 * products[0].priceCents);
  assert.ok((await listShoppingOwners()).some(record => record.userId === id && record.cartQuantity === 2));
  console.log("PASS: Registered users and their cart/wishlist records can be inspected.");

  const updated = await updateRegisteredUser(id, { name: "Updated Test Customer", expectedUpdatedAt: now });
  assert.equal(updated.name, "Updated Test Customer");
  await assert.rejects(
    updateRegisteredUser(id, { name: "Stale Update", expectedUpdatedAt: now }),
    (error: unknown) => error instanceof CustomerError && error.status === 409,
  );
  console.log("PASS: Display-name updates use optimistic concurrency and preserve email.");

  await assert.rejects(
    removeShoppingItem(id, "cart", productId, { kind: "cart", expectedVersion: 5, expectedQuantity: 2 }),
    (error: unknown) => error instanceof CustomerError && error.status === 409,
  );
  await removeShoppingItem(id, "cart", productId, { kind: "cart", expectedVersion: 1, expectedQuantity: 2 });
  assert.equal((await getShoppingDetails(id)).cart.length, 0);
  await adminDb.send(new PutCommand({ TableName: adminTable, Item: cart, ConditionExpression: "attribute_not_exists(PK)" }));
  await removeShoppingItem(id, "wishlist", productId, { kind: "wishlist", expectedAddedAt: now });
  assert.equal((await getShoppingDetails(id)).wishlist.length, 0);
  await adminDb.send(new PutCommand({ TableName: adminTable, Item: wish, ConditionExpression: "attribute_not_exists(PK)" }));
  console.log("PASS: Admin removals check cart revisions and wishlist timestamps.");

  await adminDb.send(new UpdateCommand({ TableName: adminTable, Key: key(id, "PROFILE"), UpdateExpression: "SET #role = :admin", ExpressionAttributeNames: { "#role": "role" }, ExpressionAttributeValues: { ":admin": "admin" } }));
  await assert.rejects(
    deleteRegisteredUser(id, `acct-${randomUUID()}`, { expectedUpdatedAt: updated.updatedAt, confirmEmail: email }),
    (error: unknown) => error instanceof CustomerError && error.status === 403,
  );
  await adminDb.send(new UpdateCommand({ TableName: adminTable, Key: key(id, "PROFILE"), UpdateExpression: "REMOVE #role", ExpressionAttributeNames: { "#role": "role" } }));
  await assert.rejects(
    deleteRegisteredUser(id, id, { expectedUpdatedAt: updated.updatedAt, confirmEmail: email }),
    (error: unknown) => error instanceof CustomerError && error.status === 403,
  );
  console.log("PASS: Admin and self-deletion safeguards work.");

  const guest = { ...key(guestId, "PROFILE"), entityType: "USER", id: guestId, name: "", email: "", createdAt: now, updatedAt: now };
  const guestWish = { ...key(guestId, `WISHLIST#${productId}`), entityType: "WISHLIST_ITEM", userId: guestId, productId, addedAt: now };
  for (const record of [guest, guestWish]) written.push({ PK: record.PK, SK: record.SK });
  await adminDb.send(new PutCommand({ TableName: adminTable, Item: guest, ConditionExpression: "attribute_not_exists(PK)" }));
  await adminDb.send(new PutCommand({ TableName: adminTable, Item: guestWish, ConditionExpression: "attribute_not_exists(PK)" }));
  assert.ok((await listShoppingOwners()).some(record => record.userId === guestId && record.kind === "guest"));
  await removeShoppingItem(guestId, "wishlist", productId, { kind: "wishlist", expectedAddedAt: now });
  console.log("PASS: Guest shopping activity is visible and manageable.");

  await deleteRegisteredUser(id, `acct-${randomUUID()}`, { expectedUpdatedAt: updated.updatedAt, confirmEmail: email });
  assert.equal(await getRegisteredUser(id), null);
  for (const recordKey of [key(id, "CREDENTIALS"), key(id, `CART#${productId}`), key(id, `WISHLIST#${productId}`), lookupKey]) {
    const result = await adminDb.send(new GetCommand({ TableName: adminTable, Key: recordKey, ConsistentRead: true }));
    assert.equal(result.Item, undefined);
  }
  console.log("PASS: Customer deletion atomically removes the profile, credentials, email lookup, cart and wishlist.");
}

async function main() {
  console.log(`DynamoDB Local: ${endpoint}; table: ${adminTable}`);
  console.log("Testing with temporary accounts only. Existing customers will not be modified.");
  try {
    await run();
    console.log("All Stage 4 DynamoDB tests passed.");
  } finally {
    await cleanup();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
