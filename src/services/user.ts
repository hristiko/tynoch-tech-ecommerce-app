import { userRepo } from "@/db/repositories/users";
import { profileSchema } from "@/lib/validation";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { User } from "@/types";

export const userService = {
  get: (id: string): Promise<User | null> => userRepo.get(id),

  async updateProfile(id: string, input: unknown): Promise<User> {
    const data = profileSchema.parse(input);
    if (id.startsWith("acct-")) {
      const existing = await userRepo.get(id);
      if (!existing) throw new NotFoundError("Account not found");
      // Email is the login identifier; changing it requires a separate atomic
      // email-lookup migration and re-verification, not a generic profile PUT.
      if (data.email !== existing.email) throw new ConflictError("Account email cannot be changed here.");
    } else {
      await userRepo.ensure(id);
    }
    return userRepo.updateProfile(id, data);
  },
};
