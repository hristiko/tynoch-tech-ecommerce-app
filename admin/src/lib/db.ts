import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand, type ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { ACCOUNT_ID, isAdministrator, normalizeEmail } from "./role";
import { verifyPassword } from "./password";

const base = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
    : {}),
});
const db = DynamoDBDocumentClient.from(base, { marshallOptions: { removeUndefinedValues: true } });
const table = process.env.DYNAMODB_TABLE_NAME || "tidewell-store";

export type AdminProfile = { id: string; name: string; email: string };
export type Overview = {
  users: number;
  products: number;
  categories: number;
  cartItems: number;
  wishlistItems: number;
  recordedAt: string;
};

export async function getAuthorizedAdmin(id: unknown): Promise<AdminProfile | null> {
  if (typeof id !== "string" || !ACCOUNT_ID.test(id)) return null;
  const result = await db.send(new GetCommand({
    TableName: table,
    Key: { PK: `USER#${id}`, SK: "PROFILE" },
    ConsistentRead: true,
  }));
  if (!isAdministrator(result.Item)) return null;
  return {
    id,
    name: String(result.Item?.name || "Administrator"),
    email: String(result.Item?.email || ""),
  };
}

async function limitAdminLogin(email: string): Promise<void> {
  const hash = createHash("sha256").update(email).digest("hex");
  const windowNumber = Math.floor(Date.now() / (15 * 60 * 1000));
  await db.send(new UpdateCommand({
    TableName: table,
    Key: { PK: `ADMIN_RATE#${hash}`, SK: `WINDOW#${windowNumber}` },
    UpdateExpression: "SET expiresAt = :expiry ADD attempts :one",
    ConditionExpression: "attribute_not_exists(attempts) OR attempts < :max",
    ExpressionAttributeValues: {
      ":expiry": Math.floor(Date.now() / 1000) + 30 * 60,
      ":one": 1,
      ":max": 8,
    },
  }));
}

export async function authenticateAdmin(emailInput: unknown, passwordInput: unknown): Promise<AdminProfile | null> {
  const email = normalizeEmail(emailInput);
  if (!email || typeof passwordInput !== "string" || passwordInput.length < 1 || passwordInput.length > 128) return null;
  try {
    await limitAdminLogin(email);
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") return null;
    throw error;
  }
  const digest = createHash("sha256").update(email).digest("hex");
  const lookup = await db.send(new GetCommand({
    TableName: table,
    Key: { PK: `AUTH_EMAIL#${digest}`, SK: "LOOKUP" },
    ConsistentRead: true,
  }));
  const id = lookup.Item?.userId;
  if (typeof id !== "string" || !ACCOUNT_ID.test(id)) return null;
  const [profile, credentials] = await Promise.all([
    getAuthorizedAdmin(id),
    db.send(new GetCommand({ TableName: table, Key: { PK: `USER#${id}`, SK: "CREDENTIALS" }, ConsistentRead: true })),
  ]);
  if (!profile || profile.email.toLowerCase() !== email || typeof credentials.Item?.passwordHash !== "string") return null;
  return (await verifyPassword(passwordInput, credentials.Item.passwordHash)) ? profile : null;
}

export async function getOverview(): Promise<Overview> {
  const overview: Overview = { users: 0, products: 0, categories: 0, cartItems: 0, wishlistItems: 0, recordedAt: "" };
  let cursor: ScanCommandInput["ExclusiveStartKey"];
  do {
    const response = await db.send(new ScanCommand({
      TableName: table,
      ProjectionExpression: "PK, SK, accountType",
      ExclusiveStartKey: cursor,
      ConsistentRead: true,
    }));
    for (const item of response.Items || []) {
      const pk = String(item.PK || "");
      const sk = String(item.SK || "");
      if (pk.startsWith("PRODUCT#") && sk === "METADATA") overview.products++;
      else if (pk.startsWith("CATEGORY#") && sk === "METADATA") overview.categories++;
      else if (pk.startsWith("USER#acct-") && sk === "PROFILE" && item.accountType === "registered") overview.users++;
      else if (pk.startsWith("USER#") && sk.startsWith("CART#")) overview.cartItems++;
      else if (pk.startsWith("USER#") && sk.startsWith("WISHLIST#")) overview.wishlistItems++;
    }
    cursor = response.LastEvaluatedKey;
  } while (cursor);
  overview.recordedAt = new Date().toISOString();
  return overview;
}

export const adminDb = db;
export const adminTable = table;
