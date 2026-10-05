"use client";

import { startTransition, useActionState, useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitAcademyAction, submitMatchAction } from "@/app/actions";
import { TIMEZONES } from "@/lib/domain/labels";
import { academySubmissionSchema, matchSubmissionSchema } from "@/lib/validation/schemas";
import { Error, Honeypot } from "@/components/forms/request-form";

const AGE_GROUPS = ["U10", "U12", "U14", "U16", "U19", "Senior", "Women's"];
const FACILITIES = ["Nets", "Turf pitch", "Indoor", "Bowling machine", "Gym", "Video analysis"];

export function MatchWizard() {
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState(submitMatchAction, null);
  const form = useForm({
    resolver: zodResolver(matchSubmissionSchema),
    mode: "onBlur",
    defaultValues: {
      organiserType: "club",
      contactEmail: "",
      competition: "",
      homeTeam: "",
      awayTeam: "",
      startsAt: "",
      timezone: "Asia/Kolkata",
      venue: "",
      city: "",
      country: "",
      format: "t20",
      attendanceType: "ticketed",
      sourceUrl: "",
      ticketUrl: "",
      ticketSeller: "",
      entryNotes: "",
      companyWebsite: "",
    },
  });

  if (state?.ok) {
    return (
      <div role="status" className="rounded-[1.25rem] border border-line bg-surface p-6">
        <h2 className="font-display text-3xl font-extrabold">Submission received</h2>
        <p className="mt-3 text-muted">
          It is pending review. Publishing, verification and ticket links stay with a moderator. Reference {state.id}.
        </p>
      </div>
    );
  }

  const steps = ["Organiser", "Fixture", "Source"];
  const errors = state && !state.ok ? state.errors : {};

  async function advance() {
    const fields = step === 0 ? (["organiserType", "contactEmail"] as const) : (["competition", "homeTeam", "awayTeam", "startsAt", "timezone", "venue", "city", "country", "format", "attendanceType"] as const);
    if (await form.trigger(fields)) setStep((value) => value + 1);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      void advance();
      return;
    }
    const data = new FormData(event.currentTarget);
    void form.trigger().then((valid) => {
      if (!valid) return;
      startTransition(() => action(data));
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-[1.25rem] border border-line bg-surface p-5 sm:p-7">
      <ol className="flex gap-2 text-sm" aria-label="Steps">
        {steps.map((label, index) => (
          <li key={label} className={index === step ? "font-semibold text-link" : "text-muted"} aria-current={index === step ? "step" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <Honeypot />
      <div hidden={step !== 0} className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Organiser type</legend>
          {["board", "league", "club", "academy", "venue"].map((type) => (
            <label key={type} className="flex min-h-11 items-center gap-2 capitalize">
              <input type="radio" value={type} {...form.register("organiserType")} />
              {type}
            </label>
          ))}
        </fieldset>
        <Text label="Contact email" error={form.formState.errors.contactEmail?.message} {...form.register("contactEmail")} type="email" />
      </div>
      <div hidden={step !== 1} className="grid gap-4">
        <Text label="Competition" error={form.formState.errors.competition?.message} {...form.register("competition")} />
        <Text label="Home side" error={form.formState.errors.homeTeam?.message} {...form.register("homeTeam")} />
        <Text label="Away side" error={form.formState.errors.awayTeam?.message || errors.awayTeam} {...form.register("awayTeam")} />
        <Text label="Start" type="datetime-local" error={form.formState.errors.startsAt?.message} {...form.register("startsAt")} />
        <label className="grid gap-1.5 text-sm font-medium">
          Timezone
          <select className="field" {...form.register("timezone")}>
            {TIMEZONES.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>
        <Text label="Venue" error={form.formState.errors.venue?.message} {...form.register("venue")} />
        <Text label="City" error={form.formState.errors.city?.message} {...form.register("city")} />
        <Text label="Country" error={form.formState.errors.country?.message} {...form.register("country")} />
        <label className="grid gap-1.5 text-sm font-medium">
          Format
          <select className="field" {...form.register("format")}>
            {["test", "odi", "t20", "t10", "hundred", "other"].map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Entry
          <select className="field" {...form.register("attendanceType")}>
            <option value="ticketed">Ticketed</option>
            <option value="free">Free entry</option>
            <option value="private">Private</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>
      <div hidden={step !== 2} className="grid gap-4">
        <Text label="Source URL" error={form.formState.errors.sourceUrl?.message || errors.sourceUrl} {...form.register("sourceUrl")} placeholder="https://" />
        <Text label="Ticket URL, if you have one" error={form.formState.errors.ticketUrl?.message || errors.ticketUrl} {...form.register("ticketUrl")} placeholder="https://" />
        <Text label="Seller name" {...form.register("ticketSeller")} />
        <label className="grid gap-1.5 text-sm font-medium">
          Entry notes
          <textarea className="field min-h-28" {...form.register("entryNotes")} />
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" value="true" className="mt-1 h-5 w-5" {...form.register("consent")} />
          <span>I am allowed to submit this fixture. It will not go live until a moderator approves it.</span>
        </label>
        <Error message={form.formState.errors.consent?.message || errors.consent || errors.form} />
      </div>
      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-line px-5" onClick={() => setStep((value) => value - 1)}>
            Back
          </button>
        ) : null}
        {step < 2 ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
            onClick={(event) => {
              event.preventDefault();
              void advance();
            }}
          >
            Continue
          </button>
        ) : (
          <button className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white disabled:opacity-60" disabled={pending}>
            {pending ? "Submitting" : "Submit for review"}
          </button>
        )}
      </div>
    </form>
  );
}

export function AcademyWizard({ claimSlug = "" }: { claimSlug?: string }) {
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState(submitAcademyAction, null);
  const form = useForm({
    resolver: zodResolver(academySubmissionSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      country: "",
      contactEmail: "",
      phone: "",
      website: "",
      ageGroups: [] as string[],
      facilities: [] as string[],
      description: "",
      evidence: "",
      claimSlug,
      companyWebsite: "",
    },
  });

  if (state?.ok) {
    return (
      <div role="status" className="rounded-[1.25rem] border border-line bg-surface p-6">
        <h2 className="font-display text-3xl font-extrabold">Academy submitted</h2>
        <p className="mt-3 text-muted">A moderator will check the contact before any public badge appears. Reference {state.id}.</p>
      </div>
    );
  }

  const errors = state && !state.ok ? state.errors : {};

  async function advance() {
    const fields = step === 0 ? (["name", "address", "city", "country", "contactEmail"] as const) : (["website", "ageGroups", "facilities", "description"] as const);
    if (await form.trigger(fields)) setStep((value) => value + 1);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      void advance();
      return;
    }
    const data = new FormData(event.currentTarget);
    void form.trigger().then((valid) => {
      if (!valid) return;
      startTransition(() => action(data));
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-[1.25rem] border border-line bg-surface p-5 sm:p-7">
      <Honeypot />
      <input type="hidden" {...form.register("claimSlug")} />
      <div hidden={step !== 0} className="grid gap-4">
        <Text label="Academy name" error={form.formState.errors.name?.message} {...form.register("name")} />
        <Text label="Address" error={form.formState.errors.address?.message} {...form.register("address")} />
        <Text label="City" error={form.formState.errors.city?.message} {...form.register("city")} />
        <Text label="Country" error={form.formState.errors.country?.message} {...form.register("country")} />
        <Text label="Contact email" type="email" error={form.formState.errors.contactEmail?.message} {...form.register("contactEmail")} />
        <Text label="Phone" {...form.register("phone")} />
      </div>
      <div hidden={step !== 1} className="grid gap-4">
        <Text label="Website" error={form.formState.errors.website?.message || errors.website} {...form.register("website")} placeholder="https://" />
        <CheckGroup legend="Age groups" name="ageGroups" options={AGE_GROUPS} register={form.register as unknown as UseFormRegister<{ ageGroups: string[]; facilities: string[] }>} error={form.formState.errors.ageGroups?.message || errors.ageGroups} />
        <CheckGroup legend="Facilities" name="facilities" options={FACILITIES} register={form.register as unknown as UseFormRegister<{ ageGroups: string[]; facilities: string[] }>} error={form.formState.errors.facilities?.message || errors.facilities} />
        <label className="grid gap-1.5 text-sm font-medium">
          Description
          <textarea className="field min-h-28" {...form.register("description")} />
          <Error message={form.formState.errors.description?.message || errors.description} />
        </label>
      </div>
      <div hidden={step !== 2} className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Ownership evidence
          <textarea className="field min-h-28" {...form.register("evidence")} />
          <Error message={form.formState.errors.evidence?.message || errors.evidence} />
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" value="true" className="mt-1 h-5 w-5" {...form.register("consent")} />
          <span>These contact details are mine to publish. The listing stays hidden until it is reviewed.</span>
        </label>
        <Error message={form.formState.errors.consent?.message || errors.consent || errors.form} />
      </div>
      <div className="flex gap-3">
        {step > 0 ? (
          <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-line px-5" onClick={() => setStep((value) => value - 1)}>
            Back
          </button>
        ) : null}
        {step < 2 ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
            onClick={(event) => {
              event.preventDefault();
              void advance();
            }}
          >
            Continue
          </button>
        ) : (
          <button className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white" disabled={pending}>
            {pending ? "Submitting" : "Submit academy"}
          </button>
        )}
      </div>
    </form>
  );
}

function Text({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input className="field" {...props} aria-invalid={Boolean(error)} />
      <Error message={error} />
    </label>
  );
}

function CheckGroup({
  legend,
  name,
  options,
  register,
  error,
}: {
  legend: string;
  name: "ageGroups" | "facilities";
  options: string[];
  register: UseFormRegister<{ ageGroups: string[]; facilities: string[] }>;
  error?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm">
            <input type="checkbox" value={option} {...register(name)} />
            {option}
          </label>
        ))}
      </div>
      <Error message={error} />
    </fieldset>
  );
}
