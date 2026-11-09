"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function ImportGuestButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/import-guest", { method: "POST" });
      router.push("/account");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="my-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
      <p>Your account is signed in, but importing the guest cart or wishlist did not finish. Your original guest items have been kept where possible.</p>
      <button type="button" disabled={busy} onClick={retry} className="btn-outline mt-3">{busy ? "Retrying…" : "Retry import"}</button>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}
