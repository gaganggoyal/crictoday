"use client";

import { useActionState } from "react";
import { requestMagicLinkAction } from "@/app/actions";
import { Error, Honeypot, submitKeepingValues } from "@/components/forms/request-form";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(requestMagicLinkAction, null);
  const errors = state && !state.ok ? state.errors : {};
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="grid gap-4">
      <Honeypot />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="grid gap-1.5 text-sm font-medium">
        Email
        <input
          className="field"
          type="email"
          name="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
        />
        <Error message={errors.email || errors.form} />
      </label>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#176B43] px-5 font-medium text-white"
        disabled={pending}
      >
        {pending ? "Sending" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
