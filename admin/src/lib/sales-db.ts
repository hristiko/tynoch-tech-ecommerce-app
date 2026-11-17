import { QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { adminDb, adminTable } from "./db";
import { isOrderRecord, summarizeSales, type OrderRecord, type SalesFilter, type SalesSummary } from "./sales-model";

export async function getSalesOverview(filter: SalesFilter = "all"): Promise<SalesSummary> {
  const orders: OrderRecord[] = [];
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  do {
    const result = await adminDb.send(new QueryCommand({
      TableName: adminTable,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :kind",
      ExpressionAttributeValues: { ":kind": "TYPE#ORDER" },
      ExclusiveStartKey: cursor,
      ScanIndexForward: false,
    }));
    for (const record of result.Items || []) {
      if (typeof record.PK === "string" && record.PK === `ORDER#${record.id}` && record.SK === "METADATA" && isOrderRecord(record)) {
        orders.push(record);
      }
    }
    cursor = result.LastEvaluatedKey;
  } while (cursor);

  return summarizeSales(orders, filter);
}
