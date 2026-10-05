"use client";

import { useActionState } from "react";
import { submitCorrectionAction } from "@/app/actions";
import { Error, Honeypot } from "@/components/forms/request-form";

export function CorrectionForm({ matchSlug }: { matchSlug: string }) {
  const [state, action, pending] = useActionState(submitCorrectionAction, null);
  if (state?.ok) {
    return (
      <p role="status" className="text-sm">
        Thanks. A moderator will check this report. Reference {state.id}.
      </p>
    );
  }
  const errors = state && !state.ok ? state.errors : {};
  return (
    <form action={action} className="grid gap-3">
      <Honeypot />
      <input type="hidden" name="matchSlug" value={matchSlug} />
      <label className="grid gap-1.5 text-sm font-medium">
        What should change?
        <textarea className="field min-h-28" name="details" required minLength={12} aria-invalid={Boolean(errors.details)} />
        <Error message={errors.details} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Email, optional
        <input className="field" type="email" name="email" autoComplete="email" />
        <Error message={errors.email || errors.form} />
      </label>
      <button className="inline-flex min-h-11 w-fit items-center rounded-full border border-line px-5 text-sm font-medium" disabled={pending}>
        {pending ? "Sending" : "Report incorrect details"}
      </button>
    </form>
  );
}
