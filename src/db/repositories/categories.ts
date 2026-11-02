import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { INDEX, keys, stripKeys } from "../keys";
import type { Category } from "@/types";

const toCategory = (item: Record<string, unknown>) => stripKeys(item) as unknown as Category;

export const categoryRepo = {
  async put(c: Category) {
    return dbCall("categories.put", () =>
      ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...keys.category(c.slug), GSI2PK: "TYPE#CATEGORY", GSI2SK: c.name, entityType: "CATEGORY", ...c },
        })
      )
    );
  },

  async getBySlug(slug: string): Promise<Category | null> {
    const res = await dbCall("categories.get", () =>
      ddb.send(new GetCommand({ TableName: TABLE, Key: keys.category(slug) }))
    );
    return res.Item ? toCategory(res.Item) : null;
  },

  async list(): Promise<Category[]> {
    const res = await dbCall("categories.list", () =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: INDEX.byType,
          KeyConditionExpression: "GSI2PK = :t",
          ExpressionAttributeValues: { ":t": "TYPE#CATEGORY" },
        })
      )
    );
    return (res.Items ?? []).map(toCategory);
  },
};
