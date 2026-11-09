import { AppError } from "./errors";

/** Reject cross-origin browser POSTs that rely on the user's cookies. */
export function requireSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== new URL(req.url).origin)) {
    throw new AppError("Cross-origin request rejected.", 403, "INVALID_ORIGIN");
  }
}
