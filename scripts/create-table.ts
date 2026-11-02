import "./load-env";
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { env } from "@/lib/env";

const client = new DynamoDBClient({
  region: env.region,
  endpoint: env.endpoint,
  ...(env.accessKeyId && env.secretAccessKey
    ? { credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey } }
    : {}),
});

async function main() {
  try {
    await client.send(new DescribeTableCommand({ TableName: env.tableName }));
    console.log(`Table "${env.tableName}" already exists. Nothing to do.`);
    return;
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
  }

  await client.send(
    new CreateTableCommand({
      TableName: env.tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" },
        { AttributeName: "GSI2PK", AttributeType: "S" },
        { AttributeName: "GSI2SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
        {
          IndexName: "GSI2",
          KeySchema: [
            { AttributeName: "GSI2PK", KeyType: "HASH" },
            { AttributeName: "GSI2SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    })
  );
  console.log(`Created table "${env.tableName}" (on-demand). It may take a few seconds to become ACTIVE.`);
}

main().catch((err) => {
  console.error("Failed to create table:", err);
  process.exit(1);
});
