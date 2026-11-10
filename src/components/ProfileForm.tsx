"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { profileSchema } from "@/lib/validation";
import type { User } from "@/types";

export default function ProfileForm({ user, emailReadOnly = false }: { user: Pick<User, "name" | "email">; emailReadOnly?: boolean }) {
  const [values, setValues] = useState({ name: user.name, email: user.email });
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "name" | "email";
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await api("/api/user", { method: "PUT", body: JSON.stringify(parsed.data) });
      setSaved(true);
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">Full name</label>
        <input id="name" className="field" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-err" : undefined} autoComplete="name" />
        {errors.name && <p id="name-err" className="mt-1 text-sm text-red-700">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
        <input id="email" type="email" className="field" value={values.email} readOnly={emailReadOnly} onChange={(e) => setValues({ ...values, email: e.target.value })} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} autoComplete="email" />
        {errors.email && <p id="email-err" className="mt-1 text-sm text-red-700">{errors.email}</p>}
      </div>
      {emailReadOnly && <p className="-mt-3 text-xs text-muted">Email changes are not supported yet.</p>}
      {errors.form && <p role="alert" className="text-sm text-red-700">{errors.form}</p>}
      {saved && <p role="status" className="text-sm text-green-800">Profile saved.</p>}
      <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
