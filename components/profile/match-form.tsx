"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveMatchAction } from "@/app/profile-actions";
import { Error } from "@/components/forms/request-form";
import { INDIA_STATES, indiaState } from "@/lib/data/india";
import { OWNER_FORMAT_LABEL, OWNER_FORMATS } from "@/lib/validation/profile";

export type MatchDefaults = {
  match: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  ground: string;
  state: string;
  city: string;
  format: string;
  attendance: string;
  entryNotes: string;
  ticketUrl: string;
  status: string;
};

export function MatchForm({
  profile,
  india,
  verified,
  defaults,
}: {
  profile: string;
  india: boolean;
  verified: boolean;
  defaults: MatchDefaults;
}) {
  const [state, action, pending] = useActionState(saveMatchAction, null);
  const posted = state && state.ok && "again" in state ? state : null;
  // After "post and add another" the next match starts from the last one, minus the opponent.
  const start = posted ? { ...posted.next, match: "", awayTeam: "", ticketUrl: "" } : defaults;
  const errors = state && !state.ok ? state.errors : {};
  return (
    <div className="grid gap-4">
      {posted ? (
        <p role="status" className="rounded-2xl bg-surface px-4 py-3 text-sm font-medium">
          {posted.status === "published"
            ? "Posted and live. "
            : "Saved. It goes live when your profile passes its check. "}
          <Link className="text-link" href={`/match/${posted.slug}`}>
            {posted.status === "published" ? "See the match page" : ""}
          </Link>{" "}
          Add the next one below.
        </p>
      ) : null}
      <Fields
        key={posted?.slug ?? "first"}
        profile={profile}
        india={india}
        verified={verified}
        start={start}
        action={action}
        pending={pending}
        errors={errors}
      />
    </div>
  );
}

function Fields({
  profile,
  india,
  verified,
  start,
  action,
  pending,
  errors,
}: {
  profile: string;
  india: boolean;
  verified: boolean;
  start: MatchDefaults;
  action: (formData: FormData) => void;
  pending: boolean;
  errors: Record<string, string>;
}) {
  const [stateSlug, setStateSlug] = useState(start.state);
  const [attendance, setAttendance] = useState(start.attendance || "free");
  const editing = Boolean(start.match);
  const cities = indiaState(stateSlug)?.cities ?? [];
  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="profile" value={profile} />
      <input type="hidden" name="match" value={start.match} />
      <Field
        label="Tournament or series, optional"
        hint="Leave empty for a friendly."
        error={errors.competition}
      >
        <input className="field" name="competition" defaultValue={start.competition} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Home side" error={errors.homeTeam}>
          <input className="field" name="homeTeam" defaultValue={start.homeTeam} required />
        </Field>
        <Field label="Away side" error={errors.awayTeam}>
          <input className="field" name="awayTeam" defaultValue={start.awayTeam} required />
        </Field>
        <Field label="Date" error={errors.date}>
          <input className="field" type="date" name="date" defaultValue={start.date} required />
        </Field>
        <Field label="Start time" hint="Local time at the ground." error={errors.time}>
          <input className="field" type="time" name="time" defaultValue={start.time} required />
        </Field>
        <Field label="Ground" error={errors.ground}>
          <input className="field" name="ground" defaultValue={start.ground} required />
        </Field>
        {india ? (
          <Field label="State" error={errors.state}>
            <select
              className="field"
              name="state"
              value={stateSlug}
              onChange={(event) => setStateSlug(event.target.value)}
            >
              {INDIA_STATES.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Town or city" error={errors.city}>
          <input
            className="field"
            name="city"
            list="match-cities"
            defaultValue={start.city}
            required
          />
          <datalist id="match-cities">
            {cities.map((city) => (
              <option key={city.slug} value={city.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Format" error={errors.format}>
          <select className="field" name="format" defaultValue={start.format}>
            {OWNER_FORMATS.map((format) => (
              <option key={format} value={format}>
                {OWNER_FORMAT_LABEL[format]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">How do people get in?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["free", "Free entry"],
            ["ticketed", "Tickets"],
            ["private", "Private, invited only"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm has-[:checked]:border-[#176B43]"
            >
              <input
                type="radio"
                name="attendance"
                value={value}
                checked={attendance === value}
                onChange={() => setAttendance(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <Error message={errors.attendance} />
      </fieldset>
      <Field
        label="Entry notes, optional"
        hint="Gates, seating, parking, ticket price at the gate."
        error={errors.entryNotes}
      >
        <textarea className="field min-h-24" name="entryNotes" defaultValue={start.entryNotes} />
      </Field>
      {attendance === "ticketed" ? (
        <Field
          label="Ticket link, optional"
          hint="A moderator checks the link before it shows."
          error={errors.ticketUrl}
        >
          <input
            className="field"
            type="url"
            name="ticketUrl"
            placeholder="https://"
            defaultValue={start.ticketUrl}
          />
        </Field>
      ) : null}
      {editing && verified ? (
        <Field label="Status" error={errors.status}>
          <select className="field" name="status" defaultValue={start.status}>
            <option value="published">On as planned</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      ) : null}
      <Error message={errors.form} />
      <div className="flex flex-wrap gap-3">
        <button
          name="again"
          value="0"
          className="inline-flex min-h-12 items-center rounded-full bg-[#176B43] px-6 font-medium text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Saving" : editing ? "Save match" : "Post match"}
        </button>
        {editing ? null : (
          <button
            name="again"
            value="1"
            className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-6 font-medium disabled:opacity-60"
            disabled={pending}
          >
            Post and add another
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid content-start gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      <Error message={error} />
    </label>
  );
}
