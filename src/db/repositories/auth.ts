import { createHash } from "node:crypto";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { keys } from "../keys";
import { ConflictError } from "@/lib/errors";
import type { User } from "@/types";

function emailKey(email: string) {
  return { PK: `AUTH_EMAIL#${createHash("sha256").update(email).digest("hex")}`, SK: "LOOKUP" };
}

export const authRepo = {
  async create(user: User, passwordHash: string): Promise<void> {
    try {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: { ...keys.user(user.id), entityType: "USER", accountType: "registered", ...user },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: { ...keys.userCredentials(user.id), entityType: "CREDENTIALS", passwordHash },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: { ...emailKey(user.email), entityType: "AUTH_EMAIL", userId: user.id },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }));
    } catch (error) {
      const e = error as { name?: string; CancellationReasons?: { Code?: string }[] };
      if (e.name === "TransactionCanceledException") {
        if (e.CancellationReasons?.some((reason) => reason.Code === "ConditionalCheckFailed") ||
            (await this.findByEmail(user.email))) {
          throw new ConflictError("An account with this email already exists.");
        }
      }
      return dbCall("auth.create", () => Promise.reject(error));
    }
  },

  async findByEmail(email: string): Promise<{ user: User; passwordHash: string } | null> {
    const lookup = await dbCall("auth.emailLookup", () =>
      ddb.send(new GetCommand({ TableName: TABLE, Key: emailKey(email), ConsistentRead: true }))
    );
    const id = lookup.Item?.userId;
    if (typeof id !== "string" || !/^acct-[0-9a-f-]{36}$/i.test(id)) return null;

    const [profile, credentials] = await Promise.all([
      dbCall("auth.profile", () => ddb.send(new GetCommand({ TableName: TABLE, Key: keys.user(id), ConsistentRead: true }))),
      dbCall("auth.credentials", () => ddb.send(new GetCommand({ TableName: TABLE, Key: keys.userCredentials(id), ConsistentRead: true }))),
    ]);
    if (!profile.Item || !credentials.Item || typeof credentials.Item.passwordHash !== "string") return null;
    if (profile.Item.email !== email) return null;
    const user: User = {
      id,
      name: String(profile.Item.name ?? ""),
      email,
      createdAt: String(profile.Item.createdAt ?? ""),
      updatedAt: String(profile.Item.updatedAt ?? ""),
    };
    return { user, passwordHash: credentials.Item.passwordHash };
  },
};
