import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAC_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const COOKIE_VERSION = "v1";

export function newGuestId(): string {
  return randomUUID();
}

function mac(id: string, secret: string): Buffer {
  if (secret.length < 32) throw new Error("NEXTAUTH_SECRET must contain at least 32 characters to protect guest sessions.");
  return createHmac("sha256", secret).update(`tidewell:guest:${COOKIE_VERSION}:${id}`).digest();
}

export function signGuestId(id: string, secret: string): string {
  if (!UUID_V4.test(id)) throw new Error("Invalid guest ID");
  const canonical = id.toLowerCase();
  return `${COOKIE_VERSION}.${canonical}.${mac(canonical, secret).toString("base64url")}`;
}

export function verifyGuestCookie(cookie: string | undefined, secret: string): string | null {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [version, id, signature] = parts;
  if (version !== COOKIE_VERSION || !UUID_V4.test(id) || id !== id.toLowerCase() || !MAC_BASE64URL.test(signature)) return null;
  const expected = mac(id, secret);
  const received = Buffer.from(signature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected) ? id : null;
}
