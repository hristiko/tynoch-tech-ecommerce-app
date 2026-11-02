import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __ddb: DynamoDBDocumentClient | undefined;
}

function createClient() {
  const base = new DynamoDBClient({
    region: env.region,
    endpoint: env.endpoint,
    // Only pass explicit credentials when provided; otherwise the default provider chain is used.
    ...(env.accessKeyId && env.secretAccessKey
      ? { credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey } }
      : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/** Reused across hot reloads in dev and across invocations in serverless. */
export const ddb = globalThis.__ddb ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__ddb = ddb;

export const TABLE = env.tableName;
