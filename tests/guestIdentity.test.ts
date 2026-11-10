import { describe, expect, it } from "vitest";
import { newGuestId, signGuestId, verifyGuestCookie } from "@/lib/guestIdentity";

const secret = "testing-guest-signature-secret-at-least-32-characters-long";

describe("guest identity protection", () => {
  it("signs guest identifiers and restores an unchanged identity", () => {
    const id = newGuestId();
    expect(verifyGuestCookie(signGuestId(id, secret), secret)).toBe(id);
  });

  it("rejects legacy unsigned cookies and forged guest IDs", () => {
    const id = newGuestId();
    expect(verifyGuestCookie(id, secret)).toBeNull();
    const signed = signGuestId(id, secret);
    expect(verifyGuestCookie(signed.replace(id, newGuestId()), secret)).toBeNull();
    expect(verifyGuestCookie(signed.replace(/.$/, "!"), secret)).toBeNull();
  });

  it("rejects cookies signed using another secret", () => {
    const cookie = signGuestId(newGuestId(), secret);
    expect(verifyGuestCookie(cookie, "different-secret-that-is-also-long-enough-to-use")).toBeNull();
  });

  it("rejects invalid IDs and short secrets", () => {
    expect(() => signGuestId("acct-123", secret)).toThrow();
    expect(() => signGuestId(newGuestId(), "short")).toThrow();
  });
});
