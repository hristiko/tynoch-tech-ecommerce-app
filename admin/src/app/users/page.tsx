import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { listRegisteredUsers } from "@/lib/customer-db";
import { AdminShell } from "@/components/AdminShell";
import { UsersManager } from "@/components/UsersManager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const users = await listRegisteredUsers();
  return <AdminShell adminName={admin.name} active="/users"><UsersManager initialUsers={users} adminId={admin.id} /></AdminShell>;
}
