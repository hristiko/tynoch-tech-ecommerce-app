import { AppError } from "@/lib/errors";

/** Convert low-level AWS errors into AppErrors with safe messages. */
export async function dbCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw err;
    const name = (err as { name?: string }).name ?? "UnknownError";
    console.error(`[db] ${operation} failed: ${name}`, err);
    if (name === "ResourceNotFoundException") {
      throw new AppError("Database table not found. Run `npm run db:create` and `npm run db:seed`.", 503, "DB_TABLE_MISSING");
    }
    if (name === "ProvisionedThroughputExceededException" || name === "ThrottlingException") {
      throw new AppError("The database is busy. Please retry shortly.", 503, "DB_THROTTLED");
    }
    if (name === "CredentialsProviderError" || name === "UnrecognizedClientException") {
      throw new AppError("Database credentials are not configured correctly.", 503, "DB_AUTH");
    }
    throw new AppError("A database error occurred.", 500, "DB_ERROR");
  }
}
