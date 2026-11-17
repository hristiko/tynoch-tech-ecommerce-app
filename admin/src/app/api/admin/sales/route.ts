import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthorizedAdmin } from "@/lib/db";
import { getSalesOverview } from "@/lib/sales-db";
import type { SalesFilter } from "@/lib/sales-model";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const admin = await getAuthorizedAdmin(session.user.id);
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const requested = request.nextUrl.searchParams.get("source") ?? "all";
  if (requested !== "all" && requested !== "demo" && requested !== "storefront") {
    return NextResponse.json({ error: "Invalid source filter" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const data = await getSalesOverview(requested as SalesFilter);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
