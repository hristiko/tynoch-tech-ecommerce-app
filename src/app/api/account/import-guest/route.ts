import { getServerSession } from "next-auth";
import { handle, ok } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/origin";
import { getGuestUserId, getViewerUserId } from "@/lib/session";
import { importGuestData } from "@/services/guestImport";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const session = await getServerSession(authOptions);
  const accountId = session?.user?.id;
  if (!accountId?.startsWith("acct-") || await getViewerUserId() !== accountId) throw new AppError("Sign in to continue.", 401, "UNAUTHORIZED");
  const guestId = await getGuestUserId();
  return ok(guestId ? await importGuestData(guestId, accountId) : { cartItems: 0, wishlistItems: 0 });
});
