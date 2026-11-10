import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "@/lib/env";

declare global {
  var __ddb: DynamoDBDocumentClient | undefined;
}

function createClient() {
  const base = new DynamoDBClient({
    region: env.region,
    endpoint: env.endpoint,
    ...(env.accessKeyId && env.secretAccessKey
      ? { credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey } }
      : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export const ddb = globalThis.__ddb ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__ddb = ddb;

export const TABLE = env.tableName;
