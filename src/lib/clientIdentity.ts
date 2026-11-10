import { isIP } from "node:net";

export type RequestHeaders = Headers | Record<string, string | string[] | undefined>;

function getHeader(headers: RequestHeaders, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function authClientKey(headers: RequestHeaders): string {
  if (process.env.AUTH_TRUST_PROXY !== "true") return "shared-client";
  const forwarded = getHeader(headers, "x-forwarded-for");
  const candidate = (forwarded?.split(",")[0] ?? getHeader(headers, "x-real-ip") ?? "").trim();
  return isIP(candidate) ? `ip:${candidate}` : "shared-client";
}
