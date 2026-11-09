import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import AccountAuthForm from "@/components/AccountAuthForm";
import ImportGuestButton from "@/components/ImportGuestButton";
import ProfileForm from "@/components/ProfileForm";
import SignOutButton from "@/components/SignOutButton";
import { authOptions } from "@/lib/auth";
import { userService } from "@/services/user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: { import?: string } }) {
  const session = await getServerSession(authOptions);
  const accountId = session?.user?.id;
  const account = accountId?.startsWith("acct-") ? await userService.get(accountId) : null;

  if (!account) {
    return (
      <div>
        <h1 className="mb-2 text-4xl font-extrabold">Your account</h1>
        <p className="mb-8 max-w-prose text-muted">Sign in to access your cart and wishlist from another browser. You can still browse and save items as a guest.</p>
        <AccountAuthForm />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-4xl font-extrabold">Your account</h1>
      <p className="mb-4 text-muted">Signed in as {account.email}. Your cart and wishlist are saved to this account.</p>
      {searchParams.import === "failed" && <ImportGuestButton />}
      <div className="mb-8"><SignOutButton /></div>
      <h2 className="mb-4 text-xl font-semibold">Profile</h2>
      <ProfileForm user={{ name: account.name, email: account.email }} emailReadOnly />
    </div>
  );
}
