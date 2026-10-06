"use client";

import { useActionState } from "react";
import { reviewProfileAction } from "@/app/profile-actions";
import { Error } from "@/components/forms/request-form";

export function ProfileReview({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(reviewProfileAction, null);
  if (state?.ok) {
    return (
      <p role="status" className="text-sm font-medium">
        {state.action === "approve"
          ? "Approved. The owner has been emailed."
          : "Sent back with your note."}
      </p>
    );
  }
  const errors = state && !state.ok ? state.errors : {};
  return (
    <form action={action} className="grid content-start gap-3">
      <input type="hidden" name="slug" value={slug} />
      <label className="grid gap-1.5 text-sm font-medium">
        Note to the owner, needed to send it back
        <input className="field" name="reason" placeholder="What needs to change" />
        <Error message={errors.reason} />
      </label>
      <Error message={errors.form} />
      <div className="flex flex-wrap gap-2">
        <button
          name="action"
          value="approve"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          Approve
        </button>
        <button
          name="action"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm disabled:opacity-60"
        >
          Send back
        </button>
      </div>
    </form>
  );
}
