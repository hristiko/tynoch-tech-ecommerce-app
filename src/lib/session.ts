import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

const COOKIE = "tw_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;
const GUEST_ID = /^[0-9a-f-]{36}$/i;
const ACCOUNT_ID = /^acct-[0-9a-f-]{36}$/i;

/** Guest cookies contain UUIDs only; authenticated accounts use a separate namespace. */
export function getGuestUserId(): string | null {
  const value = cookies().get(COOKIE)?.value;
  return value && GUEST_ID.test(value) ? value : null;
}

/** Only call in a Route Handler where cookies can be written. */
export function getOrCreateGuestUserId(): string {
  const existing = getGuestUserId();
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

/** Authenticated sessions always take priority over the anonymous visitor cookie. */
async function getAccountId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  return id && ACCOUNT_ID.test(id) ? id : null;
}

export async function getViewerUserId(): Promise<string | null> {
  return (await getAccountId()) ?? getGuestUserId();
}

/** Route Handlers only. Never use an unsigned guest cookie as an account identity. */
export async function getOrCreateViewerUserId(): Promise<string> {
  return (await getAccountId()) ?? getOrCreateGuestUserId();
}
