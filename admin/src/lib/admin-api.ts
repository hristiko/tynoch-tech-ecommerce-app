import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { getAuthorizedAdmin } from "./db";
import { CatalogError } from "./catalog-model";

const headers = { "Cache-Control": "no-store" };

export async function requireAdminRequest(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
  if (!(await getAuthorizedAdmin(session.user.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403, headers });
  }
  return null;
}

export function checkMutationOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) throw new CatalogError("Request origin is not allowed.", 403);
}

export async function readCatalogBody(request: NextRequest): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new CatalogError("Content-Type must be application/json.", 415);
  }
  const body = await request.text();
  if (!body || body.length > 32_000) throw new CatalogError("Request must contain a JSON object smaller than 32 KB.", 400);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new CatalogError("Invalid JSON request.", 400);
  }
}

export function catalogResponse(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers });
}

export function catalogFailure(error: unknown) {
  if (error instanceof CatalogError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  console.error("Admin catalogue request failed:", error);
  return NextResponse.json({ error: "The catalogue operation could not be completed." }, { status: 500, headers });
}
