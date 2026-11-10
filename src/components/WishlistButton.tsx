"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Props { productId: string; initial: boolean; variant?: "icon" | "full"; className?: string }

export default function WishlistButton({ productId, initial, variant = "icon", className }: Props) {
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const next = !saved;
    setSaved(next);
    setError(null);
    try {
      if (next) await api("/api/wishlist", { method: "POST", body: JSON.stringify({ productId }) });
      else await api(`/api/wishlist/${productId}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } catch (e) {
      setSaved(!next);
      setError((e as Error).message);
    }
  }

  const label = saved ? "Remove from wishlist" : "Add to wishlist";
  const heart = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s-7-4.4-9-9.2C1.5 8 3.6 4.5 7 4.5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.4 0 5.5 3.5 4 7.3C19 16.6 12 21 12 21Z" strokeLinejoin="round" />
    </svg>
  );

  if (variant === "full") {
    return (
      <div className={className}>
        <button type="button" onClick={toggle} disabled={pending} aria-pressed={saved} className="btn-outline w-full">
          <span className={saved ? "text-cobalt" : ""}>{heart}</span>
          {label}
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={label}
      title={error ?? label}
      className={cn("rounded-full bg-white/90 p-2 shadow-sm transition-colors hover:bg-white", saved ? "text-cobalt" : "text-ink", className)}
    >
      {heart}
    </button>
  );
}
