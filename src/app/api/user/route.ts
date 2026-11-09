import { requireSameOrigin } from "@/lib/origin";
import { userService } from "@/services/user";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateViewerUserId, getViewerUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const id = await getViewerUserId();
  return ok(id ? await userService.get(id) : null);
});

export const PUT = handle(async (req: Request) => {
  requireSameOrigin(req);
  return ok(await userService.updateProfile(await getOrCreateViewerUserId(), await readJson(req)));
});
