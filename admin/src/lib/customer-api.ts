import { NextResponse } from "next/server";
import { CatalogError } from "./catalog-model";
import { CustomerError } from "./customer-model";

export function customerFailure(error: unknown): NextResponse {
  if (error instanceof CustomerError || error instanceof CatalogError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error("Admin customer-management operation failed:", error);
  return NextResponse.json({ error: "Unable to complete the operation. Try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
