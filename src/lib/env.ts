/** Central place for configuration. Nothing is hardcoded; everything comes from env vars. */
export const env = {
  region: process.env.AWS_REGION ?? "eu-central-1",
  tableName: process.env.DYNAMODB_TABLE_NAME ?? "tidewell-store",
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
};
