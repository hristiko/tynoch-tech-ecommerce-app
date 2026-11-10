import { BatchGetCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { INDEX, keys, stripKeys } from "../keys";
import type { Product } from "@/types";

const toProduct = (item: Record<string, unknown>) => stripKeys(item) as unknown as Product;

export const productRepo = {
  async put(p: Product) {
    return dbCall("products.put", () =>
      ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            ...keys.product(p.id),
            GSI1PK: `CATEGORY#${p.categorySlug}`,
            GSI1SK: p.createdAt,
            GSI2PK: "TYPE#PRODUCT",
            GSI2SK: `${p.createdAt}#${p.id}`,
            entityType: "PRODUCT",
            ...p,
          },
        })
      )
    );
  },

  async getById(id: string): Promise<Product | null> {
    const res = await dbCall("products.get", () =>
      ddb.send(new GetCommand({ TableName: TABLE, Key: keys.product(id) }))
    );
    return res.Item ? toProduct(res.Item) : null;
  },

  async getMany(ids: string[]): Promise<Product[]> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return [];
    const out: Product[] = [];
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const res = await dbCall("products.batchGet", () =>
        ddb.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: chunk.map(keys.product) } } }))
      );
      (res.Responses?.[TABLE] ?? []).forEach((it) => out.push(toProduct(it)));
    }
    return out;
  },

  async listAll(): Promise<Product[]> {
    return queryAll({ IndexName: INDEX.byType, KeyConditionExpression: "GSI2PK = :t", ExpressionAttributeValues: { ":t": "TYPE#PRODUCT" }, ScanIndexForward: false });
  },

  async listByCategory(slug: string): Promise<Product[]> {
    return queryAll({ IndexName: INDEX.byCategory, KeyConditionExpression: "GSI1PK = :c", ExpressionAttributeValues: { ":c": `CATEGORY#${slug}` }, ScanIndexForward: false });
  },
};

async function queryAll(params: Omit<ConstructorParameters<typeof QueryCommand>[0], "TableName">): Promise<Product[]> {
  const items: Product[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await dbCall("products.query", () =>
      ddb.send(new QueryCommand({ ...params, TableName: TABLE, ExclusiveStartKey: lastKey }))
    );
    (res.Items ?? []).forEach((it) => items.push(toProduct(it)));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}
