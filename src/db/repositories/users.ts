import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { keys, stripKeys } from "../keys";
import type { User } from "@/types";

const toUser = (item: Record<string, unknown>) => stripKeys(item) as unknown as User;

export const userRepo = {
  async get(id: string): Promise<User | null> {
    const res = await dbCall("users.get", () => ddb.send(new GetCommand({ TableName: TABLE, Key: keys.user(id) })));
    return res.Item ? toUser(res.Item) : null;
  },

  /** Creates the user only if it does not exist yet (idempotent). */
  async ensure(id: string): Promise<User> {
    const now = new Date().toISOString();
    const user: User = { id, name: "", email: "", createdAt: now, updatedAt: now };
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...keys.user(id), entityType: "USER", ...user },
          ConditionExpression: "attribute_not_exists(PK)",
        })
      );
      return user;
    } catch (err) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
        return (await this.get(id)) ?? user;
      }
      return dbCall("users.ensure", () => Promise.reject(err));
    }
  },

  async updateProfile(id: string, data: { name: string; email: string }): Promise<User> {
    const res = await dbCall("users.update", () =>
      ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: keys.user(id),
          UpdateExpression: "SET #n = :n, email = :e, updatedAt = :u",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: { ":n": data.name, ":e": data.email, ":u": new Date().toISOString() },
          ConditionExpression: "attribute_exists(PK)",
          ReturnValues: "ALL_NEW",
        })
      )
    );
    return toUser(res.Attributes!);
  },

  async delete(id: string) {
    return dbCall("users.delete", () => ddb.send(new DeleteCommand({ TableName: TABLE, Key: keys.user(id) })));
  },
};
