import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-moss text-xl font-bold text-white">T</div>
          <div>
            <p className="text-lg font-bold tracking-tight text-ink">Tidewell</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">Store administration</p>
          </div>
        </div>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">Administrator sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Access is restricted to accounts explicitly approved for store administration.
        </p>
        <LoginForm />
        <p className="mt-8 border-t border-line pt-5 text-xs leading-5 text-slate-500">
          Admin access is granted locally by an authorized project operator. Storefront registration does not provide dashboard access.
        </p>
      </section>
    </main>
  );
}
