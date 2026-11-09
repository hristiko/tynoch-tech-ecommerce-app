import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { credentialsSchema, registrationSchema } from "@/lib/validation";

describe("registration and passwords", () => {
  it("normalizes emails and rejects weak or malformed registration", () => {
    const data = registrationSchema.parse({ name: " Ana ", email: " ANA@Example.COM ", password: "long sample passphrase" });
    expect(data.email).toBe("ana@example.com");
    expect(data.name).toBe("Ana");
    expect(() => registrationSchema.parse({ name: "A", email: "wrong", password: "short" })).toThrow();
    expect(() => registrationSchema.parse({ name: "Ana", email: "ana@example.com", password: "short" })).toThrow();
    expect(credentialsSchema.parse({ email: "  ANA@EXAMPLE.COM  ", password: "x" }).email).toBe("ana@example.com");
  });

  it("hashes with a unique salt and verifies passwords without storing plaintext", async () => {
    const one = await hashPassword("a sufficiently long password");
    const two = await hashPassword("a sufficiently long password");
    expect(one).not.toBe(two);
    expect(one).not.toContain("a sufficiently long password");
    expect(await verifyPassword("a sufficiently long password", one)).toBe(true);
    expect(await verifyPassword("wrong password", one)).toBe(false);
    expect(await verifyPassword("a sufficiently long password", "not-a-password-hash")).toBe(false);
  });
});
