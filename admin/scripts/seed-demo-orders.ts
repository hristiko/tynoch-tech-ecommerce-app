import { GetCommand, PutCommand, QueryCommand, UpdateCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { adminDb, adminTable } from "../src/lib/db";
import { createDemoOrders, DEMO_ORDER_SEED, type ProductSnapshot } from "../src/lib/demo-orders";
import { summarizeSales } from "../src/lib/sales-model";

const args = new Set(process.argv.slice(2));
const supported = new Set(["--apply", "--allow-cloud"]);
if ([...args].some(arg => !supported.has(arg))) {
  console.error("Usage: node --env-file=.env.local --import tsx scripts/seed-demo-orders.ts [--apply] [--allow-cloud]");
  process.exit(2);
}
const apply = args.has("--apply");
const endpoint = process.env.DYNAMODB_ENDPOINT || "";
let isLocal = false;
try {
  const url = new URL(endpoint);
  isLocal = (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") && url.protocol === "http:";
} catch {
  isLocal = false;
}
if (!isLocal && !(args.has("--allow-cloud") && process.env.CONFIRM_CLOUD_DEMO_SEED === "YES")) {
  console.error("Refusing non-local DynamoDB. For intentional cloud seeding, use --allow-cloud and CONFIRM_CLOUD_DEMO_SEED=YES.");
  process.exit(2);
}

const markerKey = { PK: `SEED#${DEMO_ORDER_SEED}`, SK: "METADATA" };

async function loadProducts(): Promise<ProductSnapshot[]> {
  const products: ProductSnapshot[] = [];
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  do {
    const response = await adminDb.send(new QueryCommand({
      TableName: adminTable,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :kind",
      ExpressionAttributeValues: { ":kind": "TYPE#PRODUCT" },
      ExclusiveStartKey: cursor,
    }));
    for (const item of response.Items || []) {
      if (item.PK === `PRODUCT#${item.id}` && item.SK === "METADATA") {
        products.push({ id: String(item.id), name: String(item.name), categorySlug: String(item.categorySlug), priceCents: Number(item.priceCents) });
      }
    }
    cursor = response.LastEvaluatedKey;
  } while (cursor);
  return products;
}

async function run() {
  console.log(`Database: ${endpoint || "AWS DynamoDB"}`);
  console.log(`Table: ${adminTable}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  const previous = await adminDb.send(new GetCommand({ TableName: adminTable, Key: markerKey, ConsistentRead: true }));
  if (previous.Item?.status === "complete") {
    console.log(`Demo order dataset already seeded at ${previous.Item.completedAt}. Nothing changed.`);
    return;
  }
  if (previous.Item && previous.Item.status !== "in-progress") {
    throw new Error("Unexpected demo seed marker; refusing to write.");
  }
  const anchorDate = previous.Item?.anchorDate || new Date().toISOString();
  const products = await loadProducts();
  if (products.length < 1) throw new Error("No products in the catalogue. Start DynamoDB and initialize the catalogue first.");
  const orders = createDemoOrders(products, new Date(String(anchorDate)));
  const summary = summarizeSales(orders);
  console.log(`Found ${products.length} products; generated ${orders.length} historical DEMO orders.`);
  console.log(`Completed: ${summary.completedCount}; pending: ${summary.pendingCount}; cancelled: ${summary.cancelledCount}`);
  console.log(`Illustrative completed-order revenue: EUR ${(summary.revenueCents / 100).toFixed(2)}`);
  console.log(`Seed anchor: ${anchorDate}`);
  if (!apply) {
    console.log("DRY RUN ONLY. Nothing was written. Add --apply to insert demo orders.");
    return;
  }

  if (!previous.Item) {
    await adminDb.send(new PutCommand({
      TableName: adminTable,
      Item: { ...markerKey, status: "in-progress", anchorDate, expectedCount: orders.length, createdAt: new Date().toISOString() },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
  }

  let written = 0;
  let skipped = 0;
  for (const order of orders) {
    try {
      await adminDb.send(new PutCommand({
        TableName: adminTable,
        Item: {
          PK: `ORDER#${order.id}`,
          SK: "METADATA",
          GSI2PK: "TYPE#ORDER",
          GSI2SK: `${order.createdAt}#${order.id}`,
          entityType: "ORDER",
          ...order,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }));
      written++;
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        const existing = await adminDb.send(new GetCommand({
          TableName: adminTable,
          Key: { PK: `ORDER#${order.id}`, SK: "METADATA" },
          ConsistentRead: true,
        }));
        if (existing.Item?.source !== "demo" || existing.Item?.id !== order.id) {
          throw new Error(`A non-demo record conflicts with order ${order.id}; no existing record was overwritten.`);
        }
        skipped++;
      } else throw error;
    }
  }
  await adminDb.send(new UpdateCommand({
    TableName: adminTable,
    Key: markerKey,
    UpdateExpression: "SET #status = :complete, completedAt = :date, insertedCount = :inserted, skippedCount = :skipped",
    ConditionExpression: "#status = :progress",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":complete": "complete", ":progress": "in-progress", ":date": new Date().toISOString(),
      ":inserted": written, ":skipped": skipped,
    },
  }));
  console.log(`Demo order seeding complete. Inserted ${written}; already existed ${skipped}.`);
  console.log("Existing products, accounts, carts, wishlists and stock were not changed.");
}

run().catch(error => {
  console.error("Demo order seeding failed:", error);
  process.exitCode = 1;
});
