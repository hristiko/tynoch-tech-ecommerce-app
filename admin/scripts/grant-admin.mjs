import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const table = process.env.DYNAMODB_TABLE_NAME || "tidewell-store";
const endpoint = process.env.DYNAMODB_ENDPOINT || "AWS DynamoDB (cloud)";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
    : {}),
}));

try {
  console.log(`\nDatabase: ${endpoint}`);
  console.log(`Table: ${table}`);
  const email = (process.argv[2] || "").trim().toLowerCase();
  const confirmation = process.argv[3];
  if (confirmation !== "GRANT" || process.argv.length !== 4) {
    throw new Error("Usage: node --env-file=.env.local admin/scripts/grant-admin.mjs <registered-email> GRANT");
  }
  console.log(`Checking registered account: ${email}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    throw new Error("Enter a valid registered email address.");
  }
  const digest = createHash("sha256").update(email).digest("hex");
  const lookup = await client.send(new GetCommand({ TableName: table, Key: { PK: `AUTH_EMAIL#${digest}`, SK: "LOOKUP" }, ConsistentRead: true }));
  const id = lookup.Item?.userId;
  if (typeof id !== "string" || !/^acct-[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("No registered customer account found for that email.");
  }
  const result = await client.send(new GetCommand({ TableName: table, Key: { PK: `USER#${id}`, SK: "PROFILE" }, ConsistentRead: true }));
  const profile = result.Item;
  if (profile?.accountType !== "registered" || profile.email !== email || profile.id !== id) {
    throw new Error("Account profile did not match the registered email.");
  }
  const credentials = await client.send(new GetCommand({ TableName: table, Key: { PK: `USER#${id}`, SK: "CREDENTIALS" }, ConsistentRead: true }));
  if (typeof credentials.Item?.passwordHash !== "string") throw new Error("Account has no password credentials.");
  if (profile.role === "admin") {
    console.log("This account already has administrator access. Nothing changed.");
  } else {
    console.log(`Granting administrator access to ${profile.name} (${email})...`);
    await client.send(new UpdateCommand({
        TableName: table,
        Key: { PK: `USER#${id}`, SK: "PROFILE" },
        UpdateExpression: "SET #role = :admin, updatedAt = :now",
        ConditionExpression: "attribute_exists(PK) AND accountType = :registered AND email = :email AND id = :id",
        ExpressionAttributeNames: { "#role": "role" },
        ExpressionAttributeValues: {
          ":admin": "admin",
          ":now": new Date().toISOString(),
          ":registered": "registered",
          ":email": email,
          ":id": id,
        },
      }));
    console.log("Administrator access granted. Sign in at http://localhost:3001/login using the same account credentials.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to grant administrator access.");
  process.exitCode = 1;
} finally {
  client.destroy();
}
