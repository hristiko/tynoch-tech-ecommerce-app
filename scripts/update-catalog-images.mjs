import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { categoryImages, productImages } from './image-sources.mjs';

const apply = process.argv.includes('--apply');
const endpoint = process.env.DYNAMODB_ENDPOINT;
const tableName = process.env.DYNAMODB_TABLE_NAME;
if (!endpoint || !tableName) throw new Error('DYNAMODB_ENDPOINT and DYNAMODB_TABLE_NAME must be defined');
const target = new URL(endpoint);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
  throw new Error('Refusing to update a non-local DynamoDB database');
}
if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Invalid DynamoDB endpoint');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-central-1',
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
}));

const records = [
  ...Object.entries(productImages).map(([id, image]) => ({
    type: 'PRODUCT',
    id,
    key: { PK: `PRODUCT#${id}`, SK: 'METADATA' },
    attribute: 'images',
    next: [image],
  })),
  ...Object.entries(categoryImages).map(([id, image]) => ({
    type: 'CATEGORY',
    id,
    key: { PK: `CATEGORY#${id}`, SK: 'METADATA' },
    attribute: 'image',
    next: image,
  })),
];

for (const item of records) {
  const file = path.join(process.cwd(), 'public', (item.type === 'PRODUCT' ? item.next[0] : item.next).slice(1));
  if (!existsSync(file)) throw new Error(`Missing image: ${file}`);
  const bytes = await readFile(file);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!jpeg && !png) throw new Error(`Invalid image format: ${file}`);
  const response = await ddb.send(new GetCommand({ TableName: tableName, Key: item.key, ConsistentRead: true }));
  if (!response.Item) throw new Error(`Missing DynamoDB record: ${item.type} ${item.id}`);
  item.previous = response.Item[item.attribute];
}

console.log(`Validated all ${records.length} image files and existing DynamoDB records.`);
if (!apply) {
  console.log('DRY RUN: no database changes made. Inspect photos and rerun with --apply when ready.');
} else {
  const backupPath = path.join(process.cwd(), 'image-backups');
  await mkdir(backupPath, { recursive: true });
  const filename = `catalog-images-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await writeFile(path.join(backupPath, filename), JSON.stringify({ tableName, records }, null, 2) + '\n');
  console.log(`Saved previous image attributes in image-backups/${filename}`);
  for (const item of records) {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: item.key,
      UpdateExpression: 'SET #attr = :value',
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
      ExpressionAttributeNames: { '#attr': item.attribute },
      ExpressionAttributeValues: { ':value': item.next },
    }));
    console.log(`UPDATED ${item.type} ${item.id}`);
  }
  for (const item of records) {
    const response = await ddb.send(new GetCommand({ TableName: tableName, Key: item.key, ConsistentRead: true }));
    if (JSON.stringify(response.Item?.[item.attribute]) !== JSON.stringify(item.next)) {
      throw new Error(`Verification failed for ${item.type} ${item.id}`);
    }
  }
  console.log(`SUCCESS: ${records.length} image attributes updated and verified. Other record fields were not changed.`);
}
