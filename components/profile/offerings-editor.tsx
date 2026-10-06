"use client";

import { useActionState, useState } from "react";
import { removeOfferingAction, saveOfferingAction } from "@/app/profile-actions";
import { Error } from "@/components/forms/request-form";
import { MAX_OFFERINGS, OFFERING_CATEGORIES, OFFERING_LABEL } from "@/lib/domain/profiles";
import type { Offering } from "@/lib/domain/types";

const EMPTY: Offering = {
  id: "",
  category: "coaching",
  title: "",
  price: null,
  schedule: null,
  details: null,
  url: null,
};

export function OfferingsEditor({
  profile,
  offerings,
}: {
  profile: string;
  offerings: Offering[];
}) {
  const [editing, setEditing] = useState<Offering | null>(null);
  // A new key per edit resets the form's fields to the offer being edited.
  const [formKey, setFormKey] = useState(0);
  const start = (offering: Offering) => {
    setEditing(offering);
    setFormKey((key) => key + 1);
  };

  return (
    <div className="grid gap-6">
      {offerings.length ? (
        <ul className="grid gap-3">
          {offerings.map((offering) => (
            <li
              key={offering.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.14em] text-link uppercase">
                  {OFFERING_LABEL[offering.category]}
                </p>
                <p className="mt-1 font-semibold">{offering.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {[offering.price, offering.schedule].filter(Boolean).join(" · ") ||
                    "No price or time given"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
                  onClick={() => start(offering)}
                >
                  Edit
                </button>
                <form action={removeOfferingAction}>
                  <input type="hidden" name="profile" value={profile} />
                  <input type="hidden" name="id" value={offering.id} />
                  <button className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-danger">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">
          No offers yet. Add your coaching batches, camps, trials, nets, ground hire, tournament
          entry or membership.
        </p>
      )}
      {offerings.length < MAX_OFFERINGS || editing ? (
        <OfferingForm
          key={formKey}
          profile={profile}
          offering={editing ?? EMPTY}
          onDone={() => start(EMPTY)}
          onCancel={editing ? () => start(EMPTY) : undefined}
        />
      ) : (
        <p className="text-sm text-muted">A profile can list up to {MAX_OFFERINGS} offers.</p>
      )}
    </div>
  );
}

function OfferingForm({
  profile,
  offering,
  onDone,
  onCancel,
}: {
  profile: string;
  offering: Offering;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState(async (previous: unknown, formData: FormData) => {
    const result = await saveOfferingAction(previous, formData);
    if (result.ok) onDone();
    return result;
  }, null);
  const errors = state && !state.ok ? state.errors : {};
  const editing = Boolean(offering.id);

  return (
    <form
      action={action}
      className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5"
    >
      <p className="font-display text-xl font-extrabold">
        {editing ? "Edit offer" : "Add an offer"}
      </p>
      <input type="hidden" name="profile" value={profile} />
      <input type="hidden" name="id" value={offering.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Kind of offer
          <select className="field" name="category" defaultValue={offering.category}>
            {OFFERING_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {OFFERING_LABEL[category]}
              </option>
            ))}
          </select>
          <Error message={errors.category} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Name
          <input
            className="field"
            name="title"
            placeholder="U14 coaching, Summer camp, Box cricket turf…"
            defaultValue={offering.title}
            required
          />
          <Error message={errors.title} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Price, optional
          <input
            className="field"
            name="price"
            placeholder="₹2,500 a month"
            defaultValue={offering.price ?? ""}
          />
          <Error message={errors.price} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          When, optional
          <input
            className="field"
            name="schedule"
            placeholder="Mon, Wed, Fri, 4–6pm"
            defaultValue={offering.schedule ?? ""}
          />
          <Error message={errors.schedule} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Details, optional
        <textarea className="field min-h-24" name="details" defaultValue={offering.details ?? ""} />
        <Error message={errors.details} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Booking or form link, optional
        <input
          className="field"
          name="url"
          type="url"
          placeholder="https://"
          defaultValue={offering.url ?? ""}
        />
        <Error message={errors.url} />
      </label>
      <Error message={errors.form} />
      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Saving" : editing ? "Save offer" : "Add offer"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-5"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
