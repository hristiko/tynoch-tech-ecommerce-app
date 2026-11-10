"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { api } from "@/lib/client";
import { credentialsSchema, registrationSchema } from "@/lib/validation";

type Mode = "login" | "register";

export default function AccountAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = mode === "register"
      ? registrationSchema.safeParse(values)
      : credentialsSchema.safeParse({ email: values.email, password: values.password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await api("/api/auth/register", { method: "POST", body: JSON.stringify(parsed.data) });
      }
      const result = await signIn("credentials", {
        redirect: false,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (!result || result.error) {
        if (mode === "register") {
          setMode("login");
          throw new Error("Account created, but automatic sign-in failed. Please sign in.");
        }
        if (result?.error?.includes("RATE_LIMITED")) {
          throw new Error("Too many sign-in attempts. Please try again later.");
        }
        throw new Error("Incorrect email or password.");
      }

      // Import guest-only items after the authenticated session cookie is issued.
      // If import fails, the user stays signed in and can retry from the account page.
      let importFailed = false;
      try {
        await api("/api/account/import-guest", { method: "POST" });
      } catch {
        importFailed = true;
      }
      router.push(importFailed ? "/account?import=failed" : "/account");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex gap-2" role="group" aria-label="Account actions">
        <button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(null); }} className={mode === "login" ? "btn-primary" : "btn-outline"}>Sign in</button>
        <button type="button" aria-pressed={mode === "register"} onClick={() => { setMode("register"); setError(null); }} className={mode === "register" ? "btn-primary" : "btn-outline"}>Create account</button>
      </div>
      <form onSubmit={submit} noValidate className="space-y-5">
        {mode === "register" && (
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="register-name">Full name</label>
            <input id="register-name" className="field" autoComplete="name" maxLength={80} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="auth-email">Email address</label>
          <input id="auth-email" type="email" className="field" autoComplete="email" maxLength={120} value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="auth-password">Password</label>
          <input id="auth-password" type="password" className="field" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : undefined} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} required />
          {mode === "register" && <p className="mt-1 text-xs text-muted">Use at least 12 characters.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
    </div>
  );
}
