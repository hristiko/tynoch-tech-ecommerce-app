import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthorizedAdmin, getOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const admin = await getAuthorizedAdmin(session.user.id);
  if (!admin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const data = await getOverview();
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
