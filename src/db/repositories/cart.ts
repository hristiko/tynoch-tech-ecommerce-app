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
  version: typeof it.version === "number" ? it.version : undefined,
});

/** Only an expected version may be replaced. Legacy rows have no version yet. */
function expectedCondition(previous: CartItemRecord | null) {
  const names: Record<string, string> = { "#pk": "PK" };
  const values: Record<string, number> = {};
  if (!previous) {
    return { expression: "attribute_not_exists(#pk)", names, values };
  }
  if (previous.version !== undefined) {
    names["#version"] = "version";
    values[":expectedVersion"] = previous.version;
    return {
      expression: "attribute_exists(#pk) AND #version = :expectedVersion",
      names,
      values,
    };
  }
  // Upgrade existing cart records in place on their next successful write.
  names["#version"] = "version";
  names["#quantity"] = "quantity";
  values[":expectedQuantity"] = previous.quantity;
  return {
    expression: "attribute_exists(#pk) AND attribute_not_exists(#version) AND #quantity = :expectedQuantity",
    names,
    values,
  };
}

/** A contention conflict is normal; other database failures must still surface. */
function conditionalWrite(operation: string, write: () => Promise<unknown>): Promise<boolean> {
  return dbCall(operation, async () => {
    try {
      await write();
      return true;
    } catch (err) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw err;
    }
  });
}

export const cartRepo = {
  async list(userId: string): Promise<CartItemRecord[]> {
    const res = await dbCall("cart.list", () =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": prefixes.cart },
          ConsistentRead: true,
        })
      )
    );
    return (res.Items ?? []).map(toRecord);
  },

  async get(userId: string, productId: string): Promise<CartItemRecord | null> {
    const res = await dbCall("cart.get", () =>
      ddb.send(new GetCommand({ TableName: TABLE, Key: keys.cartItem(userId, productId), ConsistentRead: true }))
    );
    return res.Item ? toRecord(res.Item) : null;
  },

  /** Compare-and-set: a concurrent update returns false instead of overwriting data. */
  async compareAndPut(item: CartItemRecord, previous: CartItemRecord | null): Promise<boolean> {
    const condition = expectedCondition(previous);
    return conditionalWrite("cart.compareAndPut", () =>
      ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          ...keys.cartItem(item.userId, item.productId),
          entityType: "CART_ITEM",
          ...item,
          version: (previous?.version ?? 0) + 1,
        },
        ConditionExpression: condition.expression,
        ExpressionAttributeNames: condition.names,
        ...(Object.keys(condition.values).length ? { ExpressionAttributeValues: condition.values } : {}),
      }))
    );
  },

  /** Used by guest import so a new guest action cannot be silently deleted. */
  async removeIfUnchanged(item: CartItemRecord): Promise<boolean> {
    const condition = expectedCondition(item);
    return conditionalWrite("cart.removeIfUnchanged", () =>
      ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: keys.cartItem(item.userId, item.productId),
        ConditionExpression: condition.expression,
        ExpressionAttributeNames: condition.names,
        ExpressionAttributeValues: condition.values,
      }))
    );
  },

  /** Explicit removal is idempotent. The last completed user action may win. */
  async remove(userId: string, productId: string) {
    return dbCall("cart.remove", () =>
      ddb.send(new DeleteCommand({ TableName: TABLE, Key: keys.cartItem(userId, productId) }))
    );
  },
};
