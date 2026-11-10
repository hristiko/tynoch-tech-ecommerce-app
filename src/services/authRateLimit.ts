import type { RequestHeaders } from "@/lib/clientIdentity";
import { authClientKey } from "@/lib/clientIdentity";
import { rateLimitsRepo } from "@/db/repositories/rateLimits";

export const authRateLimit = {
  async login(email: string, headers: RequestHeaders) {
    await rateLimitsRepo.consume({ scope: "login-client", identifier: authClientKey(headers), limit: 60, windowSeconds: 15 * 60 });
    await rateLimitsRepo.consume({ scope: "login-email", identifier: email, limit: 10, windowSeconds: 15 * 60 });
  },
  async register(email: string, headers: RequestHeaders) {
    await rateLimitsRepo.consume({ scope: "register-client", identifier: authClientKey(headers), limit: 10, windowSeconds: 60 * 60 });
    await rateLimitsRepo.consume({ scope: "register-email", identifier: email, limit: 3, windowSeconds: 60 * 60 });
  },
};
