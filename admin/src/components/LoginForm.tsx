"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });
      if (!result?.ok) {
        setError("Unable to sign in. Check your credentials and administrator access, or try again later.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-9 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink">Email address</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={120}
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-moss" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-ink">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128}
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-moss" />
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={submitting}
        className="w-full rounded-lg bg-moss px-5 py-3 font-semibold text-white transition hover:bg-ink">
        {submitting ? "Signing in…" : "Sign in to dashboard"}
      </button>
    </form>
  );
}
