import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { keys, prefixes } from "../keys";
import type { WishlistItemRecord } from "@/types";

export const wishlistRepo = {
  async list(userId: string): Promise<WishlistItemRecord[]> {
    const res = await dbCall("wishlist.list", () =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": prefixes.wishlist },
        })
      )
    );
    return (res.Items ?? []).map((it) => ({ userId: it.userId, productId: it.productId, addedAt: it.addedAt }));
  },

  async add(userId: string, productId: string): Promise<boolean> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...keys.wishlistItem(userId, productId), entityType: "WISHLIST_ITEM", userId, productId, addedAt: new Date().toISOString() },
          ConditionExpression: "attribute_not_exists(PK)",
        })
      );
      return true;
    } catch (err) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") return false;
      return dbCall("wishlist.add", () => Promise.reject(err));
    }
  },

  async remove(userId: string, productId: string) {
    return dbCall("wishlist.remove", () =>
      ddb.send(new DeleteCommand({ TableName: TABLE, Key: keys.wishlistItem(userId, productId) }))
    );
  },
};
