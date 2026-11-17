import { getServerSession } from "next-auth";
import { getAuthorizedAdmin } from "./db";
import { authOptions } from "./auth";

export async function getCurrentAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ? getAuthorizedAdmin(session.user.id) : null;
}
