"use client";

import { useActionState } from "react";
import { approveOfferAction, markVerifiedAction, reviewSubmissionAction } from "@/app/actions";
import { Error } from "@/components/forms/request-form";

export function ReviewControls({ id, mergeTargets }: { id: string; mergeTargets: Array<{ slug: string; label: string }> }) {
  const [state, action, pending] = useActionState(reviewSubmissionAction, null);
  const errors = state && !state.ok ? state.errors : {};
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1 text-sm font-medium">
        Decision
        <select className="field" name="action" defaultValue="approve">
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
          <option value="changes">Request changes</option>
          <option value="merge">Merge into an existing match</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Reason
        <textarea className="field min-h-24" name="reason" />
        <Error message={errors.reason} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Merge target
        <select className="field" name="mergeTarget" defaultValue="">
          <option value="">None</option>
          {mergeTargets.map((target) => (
            <option key={target.slug} value={target.slug}>
              {target.label}
            </option>
          ))}
        </select>
        <Error message={errors.mergeTarget || errors.form} />
      </label>
      {state?.ok ? <p role="status">Decision saved.</p> : null}
      <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#176B43] px-5 font-medium text-white" disabled={pending}>
        Save decision
      </button>
    </form>
  );
}

export function OfferButton({ matchSlug, offerId }: { matchSlug: string; offerId: string }) {
  const [state, action, pending] = useActionState(approveOfferAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="matchSlug" value={matchSlug} />
      <input type="hidden" name="offerId" value={offerId} />
      <button className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-4 text-sm font-medium text-white" disabled={pending}>
        Approve link
      </button>
      {state && !state.ok ? <Error message={state.errors.form} /> : null}
      {state?.ok ? <p role="status">Approved. {state.notified} alert{state.notified === 1 ? "" : "s"} queued.</p> : null}
    </form>
  );
}

export function VerifyButton({ matchSlug }: { matchSlug: string }) {
  const [state, action, pending] = useActionState(markVerifiedAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="matchSlug" value={matchSlug} />
      <button className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm" disabled={pending}>
        Mark verified now
      </button>
      {state?.ok ? <p role="status">Verification time updated.</p> : null}
    </form>
  );
}
