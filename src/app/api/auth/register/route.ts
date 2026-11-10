import { handle, ok, readJson } from "@/lib/api";
import { requireSameOrigin } from "@/lib/origin";
import { authService } from "@/services/auth";

export const POST = handle(async (req: Request) => {
  requireSameOrigin(req);
  const user = await authService.register(await readJson(req), req.headers);
  return ok({ id: user.id, name: user.name, email: user.email }, 201);
});
