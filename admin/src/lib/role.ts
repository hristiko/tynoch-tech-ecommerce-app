export const ACCOUNT_ID = /^acct-[0-9a-f-]{36}$/i;

export function isAdministrator(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const item = profile as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    ACCOUNT_ID.test(item.id) &&
    item.PK === `USER#${item.id}` &&
    item.SK === "PROFILE" &&
    item.accountType === "registered" &&
    item.role === "admin"
  );
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}
