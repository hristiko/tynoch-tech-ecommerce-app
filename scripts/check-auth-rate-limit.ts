import "./load-env";
import { randomUUID } from "node:crypto";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "@/db/client";
import { rateLimitsRepo, rateLimitWindow, type RateLimitRule } from "@/db/repositories/rateLimits";
import { RateLimitError } from "@/lib/errors";

async function main() {
  const rule: RateLimitRule = {
    scope: "login-email",
    identifier: `test-${randomUUID()}@example.invalid`,
    limit: 3,
    windowSeconds: 900,
  };
  const firstTime = 1_800_000;
  const secondTime = firstTime + rule.windowSeconds;
  const keys = [rateLimitWindow(rule, firstTime).Key, rateLimitWindow(rule, secondTime).Key];

  try {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => rateLimitsRepo.consume(rule, firstTime)));
    const accepted = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    if (accepted.length !== rule.limit || rejected.length !== 12 - rule.limit ||
        rejected.some((result) => result.status === "rejected" && !(result.reason instanceof RateLimitError))) {
      throw new Error(`Atomic limit failed: ${accepted.length} accepted, ${rejected.length} rejected`);
    }

    await rateLimitsRepo.consume(rule, secondTime);
    console.log("PASS: 3 concurrent requests accepted, 9 blocked; the next window accepts again.");
  } finally {
    await Promise.all(keys.map((Key) => ddb.send(new DeleteCommand({ TableName: TABLE, Key }))));
  }
}

main().catch((error) => {
  console.error("Authentication rate-limit check failed:", error);
  process.exitCode = 1;
});
