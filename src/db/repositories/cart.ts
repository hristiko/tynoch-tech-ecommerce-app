import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { keys, prefixes } from "../keys";
import type { CartItemRecord } from "@/types";

const toRecord = (it: Record<string, unknown>): CartItemRecord => ({
  userId: it.userId as string,
  productId: it.productId as string,
  quantity: it.quantity as number,
  addedAt: it.addedAt as string,
});

export const cartRepo = {
  async list(userId: string): Promise<CartItemRecord[]> {
    const res = await dbCall("cart.list", () =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": prefixes.cart },
        })
      )
    );
    return (res.Items ?? []).map(toRecord);
  },

  async get(userId: string, productId: string): Promise<CartItemRecord | null> {
    const res = await dbCall("cart.get", () =>
      ddb.send(new GetCommand({ TableName: TABLE, Key: keys.cartItem(userId, productId) }))
    );
    return res.Item ? toRecord(res.Item) : null;
  },

  async upsert(item: CartItemRecord) {
    return dbCall("cart.upsert", () =>
      ddb.send(new PutCommand({ TableName: TABLE, Item: { ...keys.cartItem(item.userId, item.productId), entityType: "CART_ITEM", ...item } }))
    );
  },

  async remove(userId: string, productId: string) {
    return dbCall("cart.remove", () =>
      ddb.send(new DeleteCommand({ TableName: TABLE, Key: keys.cartItem(userId, productId) }))
    );
  },
};
