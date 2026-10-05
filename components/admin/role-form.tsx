"use client";

import { useActionState } from "react";
import { setUserRoleAction } from "@/app/actions";
import { Error } from "@/components/forms/request-form";

const roles = [
  ["fan", "Fan"],
  ["academy_owner", "Academy owner"],
  ["organiser", "Organiser"],
  ["moderator", "Moderator"],
  ["admin", "Admin"],
];

export function RoleForm() {
  const [state, action, pending] = useActionState(setUserRoleAction, null);
  const errors = state && !state.ok ? state.errors : {};
  return (
    <form action={action} className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_180px_auto]">
      <label className="grid gap-1 text-sm font-medium">
        Account email or user id
        <input className="field" name="account" autoComplete="off" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Role
        <select className="field" name="role" defaultValue="moderator">
          {roles.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white" disabled={pending}>
          {pending ? "Saving" : "Set role"}
        </button>
      </div>
      <div className="sm:col-span-3">
        <Error message={errors.form} />
        {state?.ok ? <p role="status">Role saved. It applies on their next request.</p> : null}
      </div>
    </form>
  );
}
