import "./load-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "@/db/client";
import { keys } from "@/db/keys";
import { cartRepo } from "@/db/repositories/cart";
import { productRepo } from "@/db/repositories/products";
import { userRepo } from "@/db/repositories/users";
import { env } from "@/lib/env";
import { cartService } from "@/services/cart";
import { importGuestData } from "@/services/guestImport";
import type { Product } from "@/types";

// Refuse to run the destructive test against a hosted AWS DynamoDB table.
const localHosts = new Set(["localhost", "127.0.0.1", "host.docker.internal", "dynamodb", "tidewell-dynamodb"]);
if (!env.endpoint || !localHosts.has(new URL(env.endpoint).hostname)) {
  throw new Error("This check must run against DynamoDB Local. Set DYNAMODB_ENDPOINT in .env.local.");
}

const unique = randomUUID();
const userId = `test-${unique}`;
const guestId = randomUUID();
const accountId = `acct-${randomUUID()}`;
const productId = `cart-consistency-${unique}`;
const product: Product = {
  id: productId, name: "Temporary concurrency test product", description: "Deleted after test",
  priceCents: 1250, categorySlug: "desk", images: [], stock: 10,
  rating: 0, tags: [], createdAt: new Date().toISOString(),
};

async function main() {
  await productRepo.put(product);
  try {
    await Promise.all(Array.from({ length: 4 }, () => cartService.add(userId, productId, 1)));
    assert.equal((await cartRepo.get(userId, productId))?.quantity, 4, "Concurrent adds lost a quantity");
    console.log("PASS: four simultaneous additions retained all four items");

    await Promise.all(Array.from({ length: 4 }, () => cartService.add(userId, productId, 3)));
    assert.equal((await cartRepo.get(userId, productId))?.quantity, 10, "Stock cap was exceeded");
    console.log("PASS: concurrent additions respect stock and per-item maximum");

    await cartRepo.remove(userId, productId);
    const legacy = {
      userId, productId, quantity: 2, addedAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { ...keys.cartItem(userId, productId), entityType: "CART_ITEM", ...legacy },
    }));
    await cartService.add(userId, productId, 1);
    const updatedLegacy = await cartRepo.get(userId, productId);
    assert.equal(updatedLegacy?.quantity, 3);
    assert.equal(updatedLegacy?.version, 1);
    console.log("PASS: old unversioned cart record upgraded on write");

    await cartService.add(guestId, productId, 4);
    await cartService.add(accountId, productId, 2);
    await importGuestData(guestId, accountId);
    assert.equal((await cartRepo.get(accountId, productId))?.quantity, 2);
    assert.equal(await cartRepo.get(guestId, productId), null);
    console.log("PASS: guest import does not overwrite existing account quantity");

    console.log("All DynamoDB Local cart-consistency checks passed.");
  } finally {
    // Test IDs are unique; clean up only the temporary records created above.
    for (const id of [userId, guestId, accountId]) {
      await cartRepo.remove(id, productId);
      await userRepo.delete(id);
    }
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: keys.product(productId) }));
  }
}

main().catch((err) => {
  console.error("Cart consistency check failed:", err);
  process.exitCode = 1;
});
