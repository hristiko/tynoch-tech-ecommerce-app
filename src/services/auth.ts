import { randomUUID } from "node:crypto";
import { authRepo } from "@/db/repositories/auth";
import { authRateLimit } from "@/services/authRateLimit";
import type { RequestHeaders } from "@/lib/clientIdentity";
import { hashPassword, verifyPassword } from "@/lib/password";
import { credentialsSchema, registrationSchema } from "@/lib/validation";
import type { User } from "@/types";

export const authService = {
  async register(input: unknown, headers: RequestHeaders): Promise<User> {
    const data = registrationSchema.parse(input);
    await authRateLimit.register(data.email, headers);
    const now = new Date().toISOString();
    const user: User = { id: `acct-${randomUUID()}`, name: data.name, email: data.email, createdAt: now, updatedAt: now };
    const passwordHash = await hashPassword(data.password);
    await authRepo.create(user, passwordHash);
    return user;
  },

  async authenticate(input: unknown, headers: RequestHeaders): Promise<User | null> {
    const parsed = credentialsSchema.safeParse(input);
    if (!parsed.success) return null;
    await authRateLimit.login(parsed.data.email, headers);
    const account = await authRepo.findByEmail(parsed.data.email);
    if (!account || !(await verifyPassword(parsed.data.password, account.passwordHash))) return null;
    return account.user;
  },
};
