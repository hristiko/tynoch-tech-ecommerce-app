import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { newGuestId, signGuestId, verifyGuestCookie } from "./guestIdentity";

const COOKIE = "tw_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;
const ACCOUNT_ID = /^acct-[0-9a-f-]{36}$/i;

function guestSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to secure guest sessions.");
  return secret;
}

export async function getGuestUserId(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value ? verifyGuestCookie(value, guestSecret()) : null;
}

export async function getOrCreateGuestUserId(): Promise<string> {
  const existing = await getGuestUserId();
  if (existing) return existing;
  const id = newGuestId();
  (await cookies()).set(COOKIE, signGuestId(id, guestSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return id;
}

async function getAccountId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  return id && ACCOUNT_ID.test(id) ? id : null;
}

export async function getViewerUserId(): Promise<string | null> {
  return (await getAccountId()) ?? (await getGuestUserId());
}

export async function getOrCreateViewerUserId(): Promise<string> {
  return (await getAccountId()) ?? (await getOrCreateGuestUserId());
}
