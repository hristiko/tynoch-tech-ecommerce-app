import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand, type ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { adminDb, adminTable } from "./db";
import {
  CatalogError,
  belongsToCategory,
  hasProductReference,
  revisionCondition,
  type CategoryDraft,
  type ManagedCategory,
  type ManagedProduct,
  type ProductDraft,
} from "./catalog-model";

const productKey = (id: string) => ({ PK: `PRODUCT#${id}`, SK: "METADATA" });
const categoryKey = (slug: string) => ({ PK: `CATEGORY#${slug}`, SK: "METADATA" });

function conditionFailed(error: unknown): boolean {
  return (error as { name?: string })?.name === "ConditionalCheckFailedException";
}

function mappedProduct(item: Record<string, unknown>): ManagedProduct {
  return {
    id: String(item.id),
    name: String(item.name),
    description: String(item.description),
    priceCents: Number(item.priceCents),
    categorySlug: String(item.categorySlug),
    images: Array.isArray(item.images) ? item.images.map(String) : [],
    stock: Number(item.stock),
    rating: Number(item.rating),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    createdAt: String(item.createdAt),
    revision: Number(item.revision ?? 0),
  };
}

function mappedCategory(item: Record<string, unknown>): ManagedCategory {
  return {
    slug: String(item.slug),
    name: String(item.name),
    description: String(item.description),
    image: String(item.image),
    revision: Number(item.revision ?? 0),
  };
}

async function scanAll(expression: string, values: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: ScanCommandInput["ExclusiveStartKey"];
  do {
    const result = await adminDb.send(new ScanCommand({
      TableName: adminTable,
      FilterExpression: expression,
      ExpressionAttributeValues: values,
      ConsistentRead: true,
      ExclusiveStartKey: cursor,
    }));
    for (const item of result.Items ?? []) items.push(item);
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items;
}

export async function listProducts(): Promise<ManagedProduct[]> {
  const result = await scanAll("begins_with(PK, :prefix) AND SK = :metadata", { ":prefix": "PRODUCT#", ":metadata": "METADATA" });
  return result.filter((item) => typeof item.id === "string").map(mappedProduct)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name));
}

export async function listCategories(): Promise<ManagedCategory[]> {
  const result = await scanAll("begins_with(PK, :prefix) AND SK = :metadata", { ":prefix": "CATEGORY#", ":metadata": "METADATA" });
  return result.filter((item) => typeof item.slug === "string").map(mappedCategory).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(id: string): Promise<ManagedProduct | null> {
  const result = await adminDb.send(new GetCommand({ TableName: adminTable, Key: productKey(id), ConsistentRead: true }));
  return result.Item ? mappedProduct(result.Item) : null;
}

export async function getCategory(slug: string): Promise<ManagedCategory | null> {
  const result = await adminDb.send(new GetCommand({ TableName: adminTable, Key: categoryKey(slug), ConsistentRead: true }));
  return result.Item ? mappedCategory(result.Item) : null;
}

async function requireCategory(slug: string): Promise<void> {
  if (!(await getCategory(slug))) throw new CatalogError("Choose an existing category.", 400);
}

export async function createProduct(draft: ProductDraft): Promise<ManagedProduct> {
  await requireCategory(draft.categorySlug);
  const { expectedRevision: _, ...values } = draft;
  void _;
  const item = {
    ...productKey(draft.id),
    GSI1PK: `CATEGORY#${draft.categorySlug}`,
    GSI1SK: new Date().toISOString(),
    GSI2PK: "TYPE#PRODUCT",
    GSI2SK: "",
    entityType: "PRODUCT",
    ...values,
    createdAt: new Date().toISOString(),
    revision: 1,
  };
  item.GSI1SK = item.createdAt;
  item.GSI2SK = `${item.createdAt}#${item.id}`;
  try {
    await adminDb.send(new PutCommand({ TableName: adminTable, Item: item, ConditionExpression: "attribute_not_exists(PK)" }));
  } catch (error) {
    if (conditionFailed(error)) throw new CatalogError("A product with this ID already exists.", 409);
    throw error;
  }
  return mappedProduct(item);
}

export async function updateProduct(id: string, draft: ProductDraft): Promise<ManagedProduct> {
  if (id !== draft.id) throw new CatalogError("Product ID cannot be changed.", 400);
  const current = await getProduct(id);
  if (!current) throw new CatalogError("Product not found.", 404);
  if (current.revision !== draft.expectedRevision) throw new CatalogError("Product was changed elsewhere. Reload and try again.", 409);
  await requireCategory(draft.categorySlug);
  const expected = draft.expectedRevision as number;
  try {
    await adminDb.send(new UpdateCommand({
      TableName: adminTable,
      Key: productKey(id),
      UpdateExpression: "SET #n = :name, #d = :description, #price = :price, #category = :category, #images = :images, #stock = :stock, #rating = :rating, #tags = :tags, GSI1PK = :gsi1, updatedAt = :updated, revision = :next",
      ConditionExpression: `attribute_exists(PK) AND ${revisionCondition(expected)}`,
      ExpressionAttributeNames: { "#n": "name", "#d": "description", "#price": "priceCents", "#category": "categorySlug", "#images": "images", "#stock": "stock", "#rating": "rating", "#tags": "tags" },
      ExpressionAttributeValues: {
        ":name": draft.name,
        ":description": draft.description,
        ":price": draft.priceCents,
        ":category": draft.categorySlug,
        ":images": draft.images,
        ":stock": draft.stock,
        ":rating": draft.rating,
        ":tags": draft.tags,
        ":gsi1": `CATEGORY#${draft.categorySlug}`,
        ":updated": new Date().toISOString(),
        ":next": expected + 1,
        ...(expected ? { ":expectedRevision": expected } : {}),
      },
    }));
  } catch (error) {
    if (conditionFailed(error)) throw new CatalogError("Product was changed or deleted elsewhere. Reload and try again.", 409);
    throw error;
  }
  return (await getProduct(id)) as ManagedProduct;
}

async function containsProductReference(id: string): Promise<boolean> {
  const references = await scanAll("begins_with(PK, :user) AND (SK = :cart OR SK = :wishlist)", {
    ":user": "USER#",
    ":cart": `CART#${id}`,
    ":wishlist": `WISHLIST#${id}`,
  });
  return references.some((item) => hasProductReference(item, id));
}

export async function deleteProduct(id: string, expectedRevision: number): Promise<void> {
  const current = await getProduct(id);
  if (!current) throw new CatalogError("Product not found.", 404);
  if (current.revision !== expectedRevision) throw new CatalogError("Product changed elsewhere. Reload and try again.", 409);
  if (await containsProductReference(id)) {
    throw new CatalogError("This product is in at least one cart or wishlist. Remove those references before deleting it.", 409);
  }
  try {
    await adminDb.send(new DeleteCommand({
      TableName: adminTable,
      Key: productKey(id),
      ConditionExpression: `attribute_exists(PK) AND ${revisionCondition(expectedRevision)}`,
      ...(expectedRevision ? { ExpressionAttributeValues: { ":expectedRevision": expectedRevision } } : {}),
    }));
  } catch (error) {
    if (conditionFailed(error)) throw new CatalogError("Product changed during deletion. Reload and try again.", 409);
    throw error;
  }
}

export async function createCategory(draft: CategoryDraft): Promise<ManagedCategory> {
  const { expectedRevision: _, ...values } = draft;
  void _;
  const item = {
    ...categoryKey(draft.slug),
    GSI2PK: "TYPE#CATEGORY",
    GSI2SK: draft.name,
    entityType: "CATEGORY",
    ...values,
    revision: 1,
  };
  try {
    await adminDb.send(new PutCommand({ TableName: adminTable, Item: item, ConditionExpression: "attribute_not_exists(PK)" }));
  } catch (error) {
    if (conditionFailed(error)) throw new CatalogError("A category with this slug already exists.", 409);
    throw error;
  }
  return mappedCategory(item);
}

export async function updateCategory(slug: string, draft: CategoryDraft): Promise<ManagedCategory> {
  if (slug !== draft.slug) throw new CatalogError("Category slug cannot be changed.", 400);
  const current = await getCategory(slug);
  if (!current) throw new CatalogError("Category not found.", 404);
  if (current.revision !== draft.expectedRevision) throw new CatalogError("Category changed elsewhere. Reload and try again.", 409);
  const expected = draft.expectedRevision as number;
  try {
    await adminDb.send(new UpdateCommand({
      TableName: adminTable,
      Key: categoryKey(slug),
      UpdateExpression: "SET #n = :name, #d = :description, #image = :image, GSI2SK = :sort, updatedAt = :updated, revision = :next",
      ConditionExpression: `attribute_exists(PK) AND ${revisionCondition(expected)}`,
      ExpressionAttributeNames: { "#n": "name", "#d": "description", "#image": "image" },
      ExpressionAttributeValues: {
        ":name": draft.name,
        ":description": draft.description,
        ":image": draft.image,
        ":sort": draft.name,
        ":updated": new Date().toISOString(),
        ":next": expected + 1,
        ...(expected ? { ":expectedRevision": expected } : {}),
      },
    }));
  } catch (error) {
    if (conditionFailed(error)) throw new CatalogError("Category changed or was deleted elsewhere. Reload and try again.", 409);
    throw error;
  }
  return (await getCategory(slug)) as ManagedCategory;
}

export async function deleteCategory(slug: string, expectedRevision: number): Promise<void> {
  const current = await getCategory(slug);
  if (!current) throw new CatalogError("Category not found.", 404);
  if (current.revision !== expectedRevision) throw new CatalogError("Category changed elsewhere. Reload and try again.", 409);
  const products = await scanAll("begins_with(PK, :prefix) AND SK = :metadata AND categorySlug = :category", {
    ":prefix": "PRODUCT#",
    ":metadata": "METADATA",
    ":category": slug,
  });
  if (products.some((item) => belongsToCategory(item, slug))) {
    throw new CatalogError("This category still contains products. Move or delete those products first.", 409);
  }
  try {
    await adminDb.send(new DeleteCommand({
      TableName: adminTable,
      Key: categoryKey(slug),
      ConditionExpression: `attribute_exists(PK) AND ${revisionCondition(expectedRevision)}`,
      ...(expectedRevision ? { ExpressionAttributeValues: { ":expectedRevision": expectedRevision } } : {}),
    }));
  } catch (error) {
    if (conditionFailed(error)) throw new CatalogError("Category changed during deletion. Reload and try again.", 409);
    throw error;
  }
}
