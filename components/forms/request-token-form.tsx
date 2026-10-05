"use client";

import Link from "next/link";
import { useActionState } from "react";
import { openRequestTokenAction } from "@/app/actions";
import { Error } from "@/components/forms/request-form";

// The link in the email only opens this page. Changing the alert needs a click, because mail
// scanners fetch every link in a message and would otherwise confirm and then stop it.
export function RequestTokenForm({
  token,
  intent,
}: {
  token: string;
  intent: "verify" | "unsubscribe";
}) {
  const [state, action, pending] = useActionState(openRequestTokenAction, null);

  if (state?.ok) {
    const stopped = state.intent === "unsubscribe";
    return (
      <>
        <h1 className="font-display text-4xl font-extrabold">
          {stopped ? "Alert stopped" : "Alert confirmed"}
        </h1>
        <p className="mt-3 text-muted">
          {stopped
            ? "You will not get further email for that request."
            : "We will email you only if an approved offer becomes active. This does not reserve a seat."}
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center text-link"
          href={`/match/${state.matchSlug}`}
        >
          Back to the match
        </Link>
      </>
    );
  }

  const stop = intent === "unsubscribe";
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">
        {stop ? "Stop this ticket alert?" : "Confirm your ticket alert"}
      </h1>
      <p className="mt-3 text-muted">
        {stop
          ? "We will not email you about this request again."
          : "We email you if an approved offer is listed for this match. Confirming does not reserve a seat."}
      </p>
      <form action={action} className="mt-6 grid gap-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="intent" value={intent} />
        <button
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-[#176B43] px-5 font-medium text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Saving" : stop ? "Stop alert" : "Confirm alert"}
        </button>
        <Error message={state && !state.ok ? state.errors.form : undefined} />
      </form>
    </>
  );
}
