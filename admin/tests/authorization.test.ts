import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomBytes, scrypt } from "node:crypto";
import { isAdministrator, normalizeEmail } from "../src/lib/role";
import { verifyPassword } from "../src/lib/password";

const id = "acct-123e4567-e89b-12d3-a456-426614174000";
const profile = { PK: `USER#${id}`, SK: "PROFILE", id, accountType: "registered", role: "admin" };

describe("administrator authorization", () => {
  it("requires a registered profile and an explicit admin role", () => {
    assert.equal(isAdministrator(profile), true);
    assert.equal(isAdministrator({ ...profile, role: "customer" }), false);
    assert.equal(isAdministrator({ ...profile, role: undefined }), false);
    assert.equal(isAdministrator({ ...profile, accountType: "guest" }), false);
    assert.equal(isAdministrator({ ...profile, PK: "USER#someone-else" }), false);
    assert.equal(isAdministrator({ ...profile, SK: "CREDENTIALS" }), false);
    assert.equal(isAdministrator({ ...profile, id: "untrusted-id" }), false);
    assert.equal(isAdministrator(null), false);
  });

  it("normalizes account email lookup keys", () => {
    assert.equal(normalizeEmail("  Admin@Example.com "), "admin@example.com");
    assert.equal(normalizeEmail("not-an-email"), null);
  });
});

describe("storefront password compatibility", () => {
  it("checks salted scrypt hashes without storing plaintext", async () => {
    const salt = randomBytes(16);
    const key = await new Promise<Buffer>((resolve, reject) => {
      scrypt("long-enough-password", salt, 64, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    const stored = `scrypt$32768$${salt.toString("base64url")}$${key.toString("base64url")}`;
    assert.equal(await verifyPassword("long-enough-password", stored), true);
    assert.equal(await verifyPassword("incorrect-password", stored), false);
    assert.equal(await verifyPassword("long-enough-password", "invalid-hash"), false);
  });
});
