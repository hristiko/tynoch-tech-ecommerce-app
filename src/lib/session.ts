import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE = "tw_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Returns the current visitor id or null (does not create anything). */
export function getUserId(): string | null {
  const value = cookies().get(COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/** Returns the visitor id, issuing a new httpOnly cookie when needed. Route handlers only. */
export function getOrCreateUserId(): string {
  const existing = getUserId();
  if (existing) return existing;
  const id = randomUUID();
  cookies().set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return id;
}
