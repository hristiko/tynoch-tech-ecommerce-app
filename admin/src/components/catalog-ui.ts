export function euros(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function currencyToCents(value: string): number {
  const formatted = value.trim().replace(",", ".");
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(formatted)) {
    throw new Error("Price must be a non-negative EUR amount with at most two decimal places.");
  }
  const [units, fraction = ""] = formatted.split(".");
  return Number(units) * 100 + Number(fraction.padEnd(2, "0"));
}

export async function sendCatalogRequest<T>(path: string, method: "POST" | "PUT" | "DELETE", payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || result.data === undefined) {
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return result.data;
}

export async function fetchCatalog<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const result = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || result.data === undefined) throw new Error(result.error || `Could not load ${path}.`);
  return result.data;
}
