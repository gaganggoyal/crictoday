"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestTicketAction } from "@/app/actions";
import { ticketRequestSchema } from "@/lib/validation/schemas";

export function RequestForm({ matchSlug, cta }: { matchSlug: string; cta: string }) {
  const [state, action, pending] = useActionState(requestTicketAction, null);
  const form = useForm({
    resolver: zodResolver(ticketRequestSchema),
    defaultValues: {
      matchSlug,
      email: "",
      quantity: 2,
      countryCode: "",
      notes: "",
      consent: undefined,
      companyWebsite: "",
    },
  });

  if (state?.ok) {
    return (
      <div role="status" className="grid gap-2 rounded-2xl border border-line bg-background p-4 text-sm">
        <p className="font-medium">
          {state.already ? "You already have an alert for this match." : "Check your email to confirm the alert."}
        </p>
        <p className="text-muted">Confirming does not reserve a seat or guarantee an offer.</p>
        {"demoVerify" in state && state.demoVerify ? (
          <p>
            <a className="font-medium text-link" href={`/requests/${state.demoVerify}`}>
              Demo inbox: open the confirmation link
            </a>
          </p>
        ) : null}
        {"demoUnsubscribe" in state && state.demoUnsubscribe ? (
          <p>
            <a className="font-medium text-link" href={`/requests/${state.demoUnsubscribe}?intent=unsubscribe`}>
              Demo inbox: stop this alert
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  const errors = state && !state.ok ? state.errors : {};

  return (
    <form
      action={action}
      className="grid gap-3"
      onSubmit={async (event) => {
        const valid = await form.trigger();
        if (!valid) event.preventDefault();
      }}
    >
      <input type="hidden" name="matchSlug" value={matchSlug} />
      <Honeypot />
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input className="field" type="email" autoComplete="email" {...form.register("email")} aria-invalid={Boolean(form.formState.errors.email || errors.email)} />
        <Error message={form.formState.errors.email?.message || errors.email} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Quantity
          <input className="field" type="number" min={1} max={10} {...form.register("quantity")} />
          <Error message={form.formState.errors.quantity?.message || errors.quantity} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Your country
          <input className="field" {...form.register("countryCode")} />
          <Error message={form.formState.errors.countryCode?.message || errors.countryCode} />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Seating preference, optional
        <input className="field" {...form.register("notes")} />
      </label>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" value="true" className="mt-1 h-5 w-5" {...form.register("consent")} />
        <span>Email me about this match only. I understand a request does not reserve a ticket.</span>
      </label>
      <Error message={form.formState.errors.consent?.message || errors.consent || errors.form} />
      <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#176B43] px-5 font-medium text-white disabled:opacity-60" disabled={pending}>
        {pending ? "Sending" : cta}
      </button>
    </form>
  );
}

export function Honeypot() {
  return (
    <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden="true">
      <label>
        Company website
        <input tabIndex={-1} autoComplete="off" name="companyWebsite" />
      </label>
    </div>
  );
}

export function Error({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-sm font-medium text-danger">
      {message}
    </span>
  );
}
