import { createHash } from "node:crypto";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../client";
import { dbCall } from "../errors";
import { RateLimitError } from "@/lib/errors";

export interface RateLimitRule {
  scope: "login-email" | "login-client" | "register-email" | "register-client";
  identifier: string;
  limit: number;
  windowSeconds: number;
}

export function rateLimitWindow(rule: RateLimitRule, nowSeconds: number) {
  const window = Math.floor(nowSeconds / rule.windowSeconds);
  const windowEndsAt = (window + 1) * rule.windowSeconds;
  const digest = createHash("sha256").update(rule.identifier).digest("hex");
  return {
    Key: { PK: `RATE#${rule.scope}#${digest}`, SK: `WINDOW#${window}` },
    windowEndsAt,
    retryAfterSeconds: Math.max(1, windowEndsAt - nowSeconds),
    expiresAt: windowEndsAt + 48 * 60 * 60,
  };
}

export const rateLimitsRepo = {
  async consume(rule: RateLimitRule, nowSeconds = Math.floor(Date.now() / 1000)): Promise<void> {
    const { Key, expiresAt, retryAfterSeconds } = rateLimitWindow(rule, nowSeconds);
    try {
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key,
        UpdateExpression: "SET #expiresAt = :expiresAt ADD #count :one",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#expiresAt": "expiresAt", "#count": "attempts" },
        ExpressionAttributeValues: { ":expiresAt": expiresAt, ":one": 1, ":limit": rule.limit },
      }));
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        throw new RateLimitError(retryAfterSeconds);
      }
      await dbCall("rateLimits.consume", () => Promise.reject(error));
    }
  },
};
