import { createHash } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
  type QueryCommandInput,
  type ScanCommandInput,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { adminDb, adminTable } from "./db";
import {
  CustomerError,
  accountDeletionAllowed,
  asRegisteredUser,
  isAccountId,
  isProductId,
  isShopperId,
  summarizeShoppingOwners,
  type AccountDeletion,
  type AccountUpdate,
  type ManagedUser,
  type ManagedUserDetails,
  type ShoppingDetails,
  type ShoppingOwner,
  type ShoppingRemoval,
  type ShoppingLine,
  type WishLine,
} from "./customer-model";

const profileKey = (id: string) => ({ PK: `USER#${id}`, SK: "PROFILE" });
const userKey = (id: string, sk: string) => ({ PK: `USER#${id}`, SK: sk });
const lookupKey = (email: string) => ({
  PK: `AUTH_EMAIL#${createHash("sha256").update(email).digest("hex")}`,
  SK: "LOOKUP",
});

function isConflict(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  return name === "ConditionalCheckFailedException" || name === "TransactionCanceledException";
}

async function scanUserRecords(filter: string, values: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: ScanCommandInput["ExclusiveStartKey"];
  do {
    const result = await adminDb.send(new ScanCommand({
      TableName: adminTable,
      FilterExpression: filter,
      ExpressionAttributeValues: values,
      ProjectionExpression: "PK, SK, id, #nm, email, accountType, #role, createdAt, updatedAt, productId, quantity",
      ExpressionAttributeNames: { "#nm": "name", "#role": "role" },
      ConsistentRead: true,
      ExclusiveStartKey: cursor,
    }));
    for (const item of result.Items ?? []) items.push(item);
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function queryPartition(id: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  do {
    const result = await adminDb.send(new QueryCommand({
      TableName: adminTable,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${id}` },
      ProjectionExpression: "PK, SK, id, #nm, email, accountType, productId, quantity, addedAt, #ver",
      ExpressionAttributeNames: { "#nm": "name", "#ver": "version" },
      ConsistentRead: true,
      ExclusiveStartKey: cursor,
    }));
    for (const item of result.Items ?? []) items.push(item);
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items;
}

export async function listRegisteredUsers(): Promise<ManagedUser[]> {
  const items = await scanUserRecords("begins_with(PK, :prefix) AND SK = :profile AND accountType = :account", {
    ":prefix": "USER#acct-", ":profile": "PROFILE", ":account": "registered",
  });
  return items.map(asRegisteredUser).filter((item): item is ManagedUser => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.email.localeCompare(b.email));
}

export async function getRegisteredUser(id: string): Promise<ManagedUser | null> {
  if (!isAccountId(id)) return null;
  const response = await adminDb.send(new GetCommand({ TableName: adminTable, Key: profileKey(id), ConsistentRead: true }));
  return asRegisteredUser(response.Item);
}

export async function updateRegisteredUser(id: string, draft: AccountUpdate): Promise<ManagedUser> {
  const current = await getRegisteredUser(id);
  if (!current) throw new CustomerError("Registered account not found.", 404);
  if (current.updatedAt !== draft.expectedUpdatedAt) throw new CustomerError("Account details changed. Refresh and try again.", 409);
  const nextUpdatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString();
  try {
    await adminDb.send(new UpdateCommand({
      TableName: adminTable,
      Key: profileKey(id),
      UpdateExpression: "SET #nm = :name, updatedAt = :now",
      ConditionExpression: "attribute_exists(PK) AND accountType = :registered AND updatedAt = :old",
      ExpressionAttributeNames: { "#nm": "name" },
      ExpressionAttributeValues: { ":name": draft.name, ":now": nextUpdatedAt, ":old": draft.expectedUpdatedAt, ":registered": "registered" },
    }));
  } catch (error) {
    if (isConflict(error)) throw new CustomerError("Account was updated elsewhere. Refresh and try again.", 409);
    throw error;
  }
  return (await getRegisteredUser(id)) as ManagedUser;
}

export async function listShoppingOwners(): Promise<ShoppingOwner[]> {
  const records = await scanUserRecords(
    "begins_with(PK, :prefix) AND (SK = :profile OR begins_with(SK, :cart) OR begins_with(SK, :wishlist))",
    { ":prefix": "USER#", ":profile": "PROFILE", ":cart": "CART#", ":wishlist": "WISHLIST#" },
  );
  return summarizeShoppingOwners(records);
}

export async function getShoppingDetails(id: string): Promise<ShoppingDetails> {
  if (!isShopperId(id)) throw new CustomerError("Invalid shopper identifier.", 400);
  const records = await queryPartition(id);
  const profile = records.find(item => item.SK === "PROFILE");
  const cartRecords = records.filter(item => typeof item.SK === "string" && item.SK.startsWith("CART#"));
  const wishRecords = records.filter(item => typeof item.SK === "string" && item.SK.startsWith("WISHLIST#"));
  if (!profile && cartRecords.length === 0 && wishRecords.length === 0) throw new CustomerError("Shopping data not found.", 404);

  const registered = profile?.accountType === "registered";
  const owner: ShoppingOwner = {
    userId: id,
    name: typeof profile?.name === "string" ? profile.name : "",
    email: registered && typeof profile?.email === "string" ? profile.email : "",
    kind: registered ? "registered" : profile ? "guest" : isAccountId(id) ? "orphaned" : "guest",
    cartLines: cartRecords.length,
    cartQuantity: 0,
    wishlistItems: wishRecords.length,
  };

  const productId = (item: Record<string, unknown>) => typeof item.productId === "string" ? item.productId : typeof item.SK === "string" ? item.SK.split("#").slice(1).join("#") : "";
  const ids = [...new Set([...cartRecords, ...wishRecords].map(productId))].filter(isProductId);
  const products = new Map<string, Record<string, unknown>>();
  await Promise.all(ids.map(async productId => {
    const result = await adminDb.send(new GetCommand({
      TableName: adminTable,
      Key: { PK: `PRODUCT#${productId}`, SK: "METADATA" },
      ConsistentRead: true,
    }));
    if (result.Item) products.set(productId, result.Item);
  }));
  const productName = (idValue: string) => {
    const product = products.get(idValue);
    return typeof product?.name === "string" ? product.name : `Unknown product (${idValue})`;
  };
  const price = (idValue: string): number | null => {
    const value = products.get(idValue)?.priceCents;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const stock = (idValue: string): number | null => {
    const value = products.get(idValue)?.stock;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const cart: ShoppingLine[] = cartRecords.map(item => {
    const idValue = productId(item);
    const quantity = typeof item.quantity === "number" && Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    owner.cartQuantity += quantity;
    return {
      productId: idValue,
      productName: productName(idValue),
      priceCents: price(idValue),
      stock: stock(idValue),
      quantity,
      addedAt: typeof item.addedAt === "string" ? item.addedAt : "",
      version: typeof item.version === "number" && Number.isSafeInteger(item.version) ? item.version : null,
    };
  });
  const wishlist: WishLine[] = wishRecords.map(item => {
    const idValue = productId(item);
    return {
      productId: idValue,
      productName: productName(idValue),
      priceCents: price(idValue),
      stock: stock(idValue),
      addedAt: typeof item.addedAt === "string" ? item.addedAt : "",
    };
  });
  cart.sort((a, b) => a.productName.localeCompare(b.productName));
  wishlist.sort((a, b) => a.productName.localeCompare(b.productName));
  return {
    owner,
    cart,
    wishlist,
    cartSubtotalCents: cart.reduce((sum, item) => sum + (item.priceCents ?? 0) * item.quantity, 0),
  };
}

export async function getUserDetails(id: string): Promise<ManagedUserDetails> {
  const user = await getRegisteredUser(id);
  if (!user) throw new CustomerError("Registered account not found.", 404);
  return { user, shopping: await getShoppingDetails(id) };
}

export async function removeShoppingItem(userId: string, kind: string, productId: string, draft: ShoppingRemoval): Promise<void> {
  if (!isShopperId(userId) || !isProductId(productId)) throw new CustomerError("Invalid shopping record identifier.", 400);
  if ((kind !== "cart" && kind !== "wishlist") || draft.kind !== kind) throw new CustomerError("Invalid shopping record type.", 400);
  const sk = `${kind === "cart" ? "CART" : "WISHLIST"}#${productId}`;
  const key = userKey(userId, sk);
  const current = await adminDb.send(new GetCommand({ TableName: adminTable, Key: key, ConsistentRead: true }));
  if (!current.Item) throw new CustomerError("Shopping record was already removed. Refresh the page.", 404);
  const names: Record<string, string> = { "#pk": "PK" };
  const values: Record<string, unknown> = {};
  let condition = "attribute_exists(#pk)";
  if (draft.kind === "cart") {
    const version = typeof current.Item.version === "number" ? current.Item.version : null;
    if (version !== draft.expectedVersion || current.Item.quantity !== draft.expectedQuantity) {
      throw new CustomerError("The cart changed. Refresh and try again.", 409);
    }
    names["#ver"] = "version";
    names["#quantity"] = "quantity";
    values[":quantity"] = draft.expectedQuantity;
    condition += " AND #quantity = :quantity";
    if (draft.expectedVersion === null) condition += " AND attribute_not_exists(#ver)";
    else {
      values[":version"] = draft.expectedVersion;
      condition += " AND #ver = :version";
    }
  } else {
    if (current.Item.addedAt !== draft.expectedAddedAt) {
      throw new CustomerError("The wishlist changed. Refresh and try again.", 409);
    }
    values[":addedAt"] = draft.expectedAddedAt;
    condition += " AND addedAt = :addedAt";
  }
  try {
    await adminDb.send(new DeleteCommand({
      TableName: adminTable,
      Key: key,
      ConditionExpression: condition,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  } catch (error) {
    if (isConflict(error)) throw new CustomerError("The shopping record changed. Refresh and try again.", 409);
    throw error;
  }
}

async function hasStorefrontOrders(id: string): Promise<boolean> {
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  do {
    const result = await adminDb.send(new QueryCommand({
      TableName: adminTable,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :order",
      FilterExpression: "customerId = :id AND #src = :source",
      ExpressionAttributeNames: { "#src": "source" },
      ExpressionAttributeValues: { ":order": "TYPE#ORDER", ":id": id, ":source": "storefront" },
      ProjectionExpression: "PK, customerId, #src",
      ExclusiveStartKey: cursor,
    }));
    if (result.Items?.length) return true;
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return false;
}

export async function deleteRegisteredUser(id: string, actorId: string, draft: AccountDeletion): Promise<void> {
  const current = await getRegisteredUser(id);
  if (!current) throw new CustomerError("Registered account not found.", 404);
  if (!accountDeletionAllowed(id, actorId, current.role)) {
    throw new CustomerError("Administrator accounts and your own account cannot be deleted here.", 403);
  }
  if (current.updatedAt !== draft.expectedUpdatedAt) throw new CustomerError("Account changed. Refresh and try again.", 409);
  if (current.email.toLowerCase() !== draft.confirmEmail) throw new CustomerError("Account email confirmation does not match.", 400);
  if (await hasStorefrontOrders(id)) {
    throw new CustomerError("This account has recorded storefront orders. Account deletion is disabled to preserve purchase records.", 409);
  }

  const records = await queryPartition(id);
  const allowed = (sk: string) => sk === "PROFILE" || sk === "CREDENTIALS" || sk.startsWith("CART#") || sk.startsWith("WISHLIST#");
  if (records.some(record => typeof record.SK !== "string" || !allowed(record.SK))) {
    throw new CustomerError("The account has records requiring manual review before deletion.", 409);
  }
  if (!records.some(record => record.SK === "PROFILE") || !records.some(record => record.SK === "CREDENTIALS")) {
    throw new CustomerError("Account records are incomplete. Deletion was cancelled.", 409);
  }
  if (records.length + 1 > 100) throw new CustomerError("This account has too many linked records for a safe transactional deletion.", 409);
  const emailLookup = lookupKey(current.email);
  const lookup = await adminDb.send(new GetCommand({ TableName: adminTable, Key: emailLookup, ConsistentRead: true }));
  if (lookup.Item?.userId !== id) throw new CustomerError("Email lookup does not match this account. Deletion was cancelled.", 409);

  type TransactionItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];
  const txItems: TransactionItem[] = records.map((record): TransactionItem => {
    const sk = String(record.SK);
    const key = userKey(id, sk);
    if (sk === "PROFILE") {
      return { Delete: {
        TableName: adminTable,
        Key: key,
        ConditionExpression: "attribute_exists(PK) AND accountType = :registered AND updatedAt = :updated AND (attribute_not_exists(#role) OR #role <> :admin)",
        ExpressionAttributeNames: { "#role": "role" },
        ExpressionAttributeValues: { ":registered": "registered", ":updated": draft.expectedUpdatedAt, ":admin": "admin" },
      } };
    }
    if (sk.startsWith("CART#")) {
      const version = typeof record.version === "number" && Number.isSafeInteger(record.version) ? record.version : null;
      const quantity = typeof record.quantity === "number" && Number.isSafeInteger(record.quantity) && record.quantity > 0 ? record.quantity : null;
      if (version === null && quantity === null) throw new CustomerError("A cart record requires manual review before deletion.", 409);
      return { Delete: {
        TableName: adminTable,
        Key: key,
        ConditionExpression: version !== null ? "attribute_exists(PK) AND #version = :version" : "attribute_exists(PK) AND attribute_not_exists(#version) AND quantity = :quantity",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: version !== null ? { ":version": version } : { ":quantity": quantity as number },
      } };
    }
    if (sk.startsWith("WISHLIST#")) {
      if (typeof record.addedAt !== "string" || !record.addedAt) throw new CustomerError("A wishlist record requires manual review before deletion.", 409);
      return { Delete: {
        TableName: adminTable,
        Key: key,
        ConditionExpression: "attribute_exists(PK) AND addedAt = :addedAt",
        ExpressionAttributeValues: { ":addedAt": record.addedAt },
      } };
    }
    return { Delete: { TableName: adminTable, Key: key, ConditionExpression: "attribute_exists(PK)" } };
  });
  txItems.push({ Delete: {
    TableName: adminTable,
    Key: emailLookup,
    ConditionExpression: "attribute_exists(PK) AND userId = :id",
    ExpressionAttributeValues: { ":id": id },
  } });
  try {
    await adminDb.send(new TransactWriteCommand({ TransactItems: txItems }));
  } catch (error) {
    if (isConflict(error)) throw new CustomerError("The account changed during deletion. Refresh and try again.", 409);
    throw error;
  }
}
