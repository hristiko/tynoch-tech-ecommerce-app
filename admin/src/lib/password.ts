import { scrypt, timingSafeEqual } from "node:crypto";

const N = 1 << 15;
const KEY_LENGTH = 64;
const OPTIONS = { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0 || password.length > 128) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== String(N)) return false;
  const salt = Buffer.from(parts[2], "base64url");
  const expected = Buffer.from(parts[3], "base64url");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
  return timingSafeEqual(actual, expected);
}
