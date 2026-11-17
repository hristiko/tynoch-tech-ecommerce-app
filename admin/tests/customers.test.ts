import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CustomerError,
  accountDeletionAllowed,
  asRegisteredUser,
  isAccountId,
  isProductId,
  isShopperId,
  ownerLabel,
  parseAccountDeletion,
  parseAccountUpdate,
  parseShoppingRemoval,
  summarizeShoppingOwners,
} from "../src/lib/customer-model";

const id = "acct-12345678-1234-1234-1234-123456789abc";
const date = "2026-11-17T10:00:00.000Z";

function bad(fn: () => unknown, status = 400) {
  assert.throws(fn, (error: unknown) => error instanceof CustomerError && error.status === status);
}

describe("user and shopping management validation", () => {
  it("accepts registered account IDs and blocks DynamoDB key injection", () => {
    assert.ok(isAccountId(id));
    assert.ok(isShopperId(id));
    assert.ok(isShopperId("guest-12345678-1234-1234-1234-123456789abc"));
    assert.ok(!isAccountId("guest-12345678-1234-1234-1234-123456789abc"));
    assert.ok(!isShopperId("acct-123#CREDENTIALS"));
    assert.ok(!isShopperId("USER#other"));
    assert.ok(!isProductId("product#other"));
    assert.ok(isProductId("oak-monitor-riser"));
  });

  it("exposes only safe profile fields, not credentials or secret material", () => {
    const row = { PK: `USER#${id}`, SK: "PROFILE", accountType: "registered", id, name: "Alice", email: "alice@example.com", role: "customer", createdAt: date, updatedAt: date, passwordHash: "SECRET" };
    const mapped = asRegisteredUser(row);
    assert.equal(mapped?.email, "alice@example.com");
    assert.equal(mapped?.role, "customer");
    assert.ok(!JSON.stringify(mapped).includes("SECRET"));
    assert.equal(asRegisteredUser({ ...row, PK: "USER#other" }), null);
    assert.equal(asRegisteredUser({ ...row, accountType: "guest" }), null);
    assert.equal(asRegisteredUser({ ...row, SK: "CREDENTIALS" }), null);
  });

  it("permits display-name-only edits with a revision and rejects privileged fields", () => {
    assert.deepEqual(parseAccountUpdate({ name: "  New Name  ", expectedUpdatedAt: date }), { name: "New Name", expectedUpdatedAt: date });
    bad(() => parseAccountUpdate({ name: "A", expectedUpdatedAt: date }));
    bad(() => parseAccountUpdate({ name: "New Name", expectedUpdatedAt: "not-a-date" }));
    bad(() => parseAccountUpdate({ name: "New Name", expectedUpdatedAt: date, role: "admin" }));
    bad(() => parseAccountUpdate({ name: "New Name", expectedUpdatedAt: date, email: "hijack@example.com" }));
  });

  it("requires explicit account email confirmation for deletion", () => {
    assert.deepEqual(parseAccountDeletion({ expectedUpdatedAt: date, confirmEmail: " ALICE@EXAMPLE.COM " }), { expectedUpdatedAt: date, confirmEmail: "alice@example.com" });
    bad(() => parseAccountDeletion({ expectedUpdatedAt: date }));
    bad(() => parseAccountDeletion({ expectedUpdatedAt: date, confirmEmail: "", role: "customer" }));
  });

  it("prevents deletion of current or any administrator account", () => {
    assert.ok(accountDeletionAllowed(id, "acct-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "customer"));
    assert.ok(!accountDeletionAllowed(id, id, "customer"));
    assert.ok(!accountDeletionAllowed(id, "acct-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "admin"));
  });

  it("requires exact cart revision and quantity for removals", () => {
    assert.deepEqual(parseShoppingRemoval("cart", { expectedVersion: 4, expectedQuantity: 2 }), { kind: "cart", expectedVersion: 4, expectedQuantity: 2 });
    assert.deepEqual(parseShoppingRemoval("cart", { expectedVersion: null, expectedQuantity: 1 }), { kind: "cart", expectedVersion: null, expectedQuantity: 1 });
    bad(() => parseShoppingRemoval("cart", { expectedVersion: -1, expectedQuantity: 1 }));
    bad(() => parseShoppingRemoval("cart", { expectedVersion: 1, expectedQuantity: 0 }));
    bad(() => parseShoppingRemoval("cart", { expectedVersion: 1, expectedQuantity: 1, userId: "other" }));
  });

  it("requires an exact wishlist item timestamp", () => {
    assert.deepEqual(parseShoppingRemoval("wishlist", { expectedAddedAt: date }), { kind: "wishlist", expectedAddedAt: date });
    bad(() => parseShoppingRemoval("wishlist", { expectedAddedAt: "abc" }));
    bad(() => parseShoppingRemoval("any", { expectedAddedAt: date }));
  });
});

describe("shopping activity aggregation", () => {
  const guest = "guest-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const items: Record<string, unknown>[] = [
    { PK: `USER#${id}`, SK: "PROFILE", accountType: "registered", name: "Alice", email: "alice@example.com" },
    { PK: `USER#${id}`, SK: "CART#one", quantity: 3 },
    { PK: `USER#${id}`, SK: "WISHLIST#two" },
    { PK: `USER#${guest}`, SK: "PROFILE", name: "" },
    { PK: `USER#${guest}`, SK: "CART#two", quantity: 1 },
    { PK: `USER#${id}`, SK: "CREDENTIALS", passwordHash: "NEVER_EXPOSE" },
    { PK: "AUTH_EMAIL#hash", SK: "LOOKUP", email: "internal@example.com" },
  ];

  it("groups registered and guest activity without exposing credentials", () => {
    const groups = summarizeShoppingOwners(items);
    assert.equal(groups.length, 2);
    const registered = groups.find(group => group.userId === id);
    const guestOwner = groups.find(group => group.userId === guest);
    assert.equal(registered?.cartLines, 1);
    assert.equal(registered?.cartQuantity, 3);
    assert.equal(registered?.wishlistItems, 1);
    assert.equal(registered?.kind, "registered");
    assert.equal(guestOwner?.kind, "guest");
    assert.ok(ownerLabel(guestOwner!).startsWith("Guest"));
    assert.ok(!JSON.stringify(groups).includes("NEVER_EXPOSE"));
  });

  it("does not show accounts without any cart or wishlist items", () => {
    const onlyProfile = summarizeShoppingOwners([{ PK: `USER#${id}`, SK: "PROFILE", accountType: "registered", name: "Alice", email: "alice@example.com" }]);
    assert.deepEqual(onlyProfile, []);
  });
});
