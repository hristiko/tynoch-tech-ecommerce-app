"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="btn-outline" type="button" onClick={() => signOut({ callbackUrl: "/account" })}>
      Sign out
    </button>
  );
}
