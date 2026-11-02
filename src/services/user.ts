import { userRepo } from "@/db/repositories/users";
import { profileSchema } from "@/lib/validation";
import type { User } from "@/types";

export const userService = {
  get: (id: string): Promise<User | null> => userRepo.get(id),

  async updateProfile(id: string, input: unknown): Promise<User> {
    const data = profileSchema.parse(input);
    await userRepo.ensure(id);
    return userRepo.updateProfile(id, data);
  },
};
