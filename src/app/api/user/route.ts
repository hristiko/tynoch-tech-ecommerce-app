import { userService } from "@/services/user";
import { handle, ok, readJson } from "@/lib/api";
import { getOrCreateUserId, getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const id = getUserId();
  return ok(id ? await userService.get(id) : null);
});

export const PUT = handle(async (req: Request) => {
  return ok(await userService.updateProfile(getOrCreateUserId(), await readJson(req)));
});
