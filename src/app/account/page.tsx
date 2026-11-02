import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import { userService } from "@/services/user";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const id = getUserId();
  const user = id ? await userService.get(id) : null;
  return (
    <div>
      <h1 className="mb-2 text-4xl font-extrabold">Account</h1>
      <p className="mb-8 max-w-prose text-muted">
        You’re browsing as a guest. Your cart and wishlist are tied to this browser. Add your details so they’re saved with your profile.
      </p>
      <ProfileForm user={{ name: user?.name ?? "", email: user?.email ?? "" }} />
    </div>
  );
}
