import { describe, expect, it } from "vitest";
import { authClientKey } from "@/lib/clientIdentity";
import { rateLimitWindow } from "@/db/repositories/rateLimits";

describe("authentication rate-limit identifiers", () => {
  const rule = { scope: "login-email" as const, identifier: "example@example.com", limit: 10, windowSeconds: 900 };

  it("does not include the email address in a database key", () => {
    const bucket = rateLimitWindow(rule, 2_000_000);
    expect(bucket.Key.PK).toMatch(/^RATE#login-email#[a-f0-9]{64}$/);
    expect(bucket.Key.PK).not.toContain("example@example.com");
  });

  it("keeps attempts in a fixed window and computes a retry interval", () => {
    const first = rateLimitWindow(rule, 900);
    const last = rateLimitWindow(rule, 1799);
    const next = rateLimitWindow(rule, 1800);
    expect(last.Key).toEqual(first.Key);
    expect(next.Key).not.toEqual(first.Key);
    expect(last.retryAfterSeconds).toBe(1);
    expect(next.retryAfterSeconds).toBe(900);
    expect(first.expiresAt).toBeGreaterThan(next.windowEndsAt);
  });

  it("ignores untrusted forwarding headers by default", () => {
    const original = process.env.AUTH_TRUST_PROXY;
    delete process.env.AUTH_TRUST_PROXY;
    try {
      expect(authClientKey(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("shared-client");
    } finally {
      if (original === undefined) delete process.env.AUTH_TRUST_PROXY;
      else process.env.AUTH_TRUST_PROXY = original;
    }
  });

  it("uses an IP only when the forwarding proxy is explicitly trusted", () => {
    const original = process.env.AUTH_TRUST_PROXY;
    process.env.AUTH_TRUST_PROXY = "true";
    try {
      expect(authClientKey({ "x-forwarded-for": "192.0.2.1, 10.0.0.1" })).toBe("ip:192.0.2.1");
      expect(authClientKey(new Headers({ "x-forwarded-for": "garbage" }))).toBe("shared-client");
    } finally {
      if (original === undefined) delete process.env.AUTH_TRUST_PROXY;
      else process.env.AUTH_TRUST_PROXY = original;
    }
  });
});
