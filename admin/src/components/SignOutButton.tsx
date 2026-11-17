"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper">
      Sign out
    </button>
  );
}
