"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProfileAction, updateProfileAction } from "@/app/profile-actions";
import { Error, Honeypot } from "@/components/forms/request-form";
import { INDIA_STATES, indiaState } from "@/lib/data/india";
import { TIMEZONES } from "@/lib/domain/labels";
import {
  AGE_GROUPS,
  FACILITIES,
  PROFILE_KIND_HINT,
  PROFILE_KIND_LABEL,
  PROFILE_KINDS,
} from "@/lib/domain/profiles";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

export type ProfileDefaults = Omit<ProfileInput, "consent" | "kind"> & { kind: string };

export function ProfileForm({
  slug,
  defaults,
  countries,
}: {
  /** Set when editing an existing profile. */
  slug?: string;
  defaults: ProfileDefaults;
  countries: Array<{ slug: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    slug ? updateProfileAction : createProfileAction,
    null,
  );
  const form = useForm({
    resolver: zodResolver(profileSchema),
    // A new profile starts with no kind chosen; the resolver asks for one.
    defaultValues: {
      ...defaults,
      kind: defaults.kind as ProfileInput["kind"],
      consent: slug ? true : undefined,
    },
  });
  const country = useWatch({ control: form.control, name: "country" });
  const stateSlug = useWatch({ control: form.control, name: "state" });
  const cities = indiaState(stateSlug)?.cities ?? [];
  const serverErrors = state && !state.ok ? state.errors : {};
  const error = (key: keyof ProfileInput) =>
    (form.formState.errors[key]?.message as string | undefined) || serverErrors[key];
  const saved = state && state.ok && "status" in state ? state.status : null;

  // Validate on submit, then field by field as answers change. Validating on blur would remove
  // an error above the button while it is being clicked, and the moving button loses the click.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const element = event.currentTarget;
    void form.handleSubmit(() => {
      startTransition(() => action(new FormData(element)));
    })(event);
  };

  return (
    <form
      action={action}
      onSubmit={submit}
      className="grid gap-8"
      noValidate
    >
      <Honeypot />
      {slug ? <input type="hidden" name="slug" value={slug} /> : null}

      <fieldset className="grid gap-3">
        <legend className="mb-2 font-display text-2xl font-extrabold">What do you run?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROFILE_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-surface p-4 has-[:checked]:border-[#176B43] has-[:checked]:ring-2 has-[:checked]:ring-[#176B43]/25"
            >
              <input
                type="radio"
                value={kind}
                className="mt-1 h-5 w-5"
                {...form.register("kind")}
              />
              <span>
                <span className="block font-semibold">{PROFILE_KIND_LABEL[kind]}</span>
                <span className="mt-1 block text-sm text-muted">{PROFILE_KIND_HINT[kind]}</span>
              </span>
            </label>
          ))}
        </div>
        <Error message={error("kind")} />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold">About you</legend>
        <Field label="Name" error={error("name")}>
          <input className="field" autoComplete="organization" {...form.register("name")} />
        </Field>
        <Field
          label="About"
          hint="Who you are, who you coach or play, and what makes you worth a visit."
          error={error("description")}
        >
          <textarea className="field min-h-32" {...form.register("description")} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold">Where</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" error={error("country")}>
            <select className="field" {...form.register("country")}>
              {countries.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          {country === "india" ? (
            <Field label="State or union territory" error={error("state")}>
              <select className="field" {...form.register("state")}>
                <option value="">Choose a state</option>
                {INDIA_STATES.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label="Time zone"
              hint="Match times are shown in this zone."
              error={error("timezone")}
            >
              <select className="field" {...form.register("timezone")}>
                <option value="">The country&apos;s usual zone</option>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label="Town or city"
            hint={country === "india" ? "Pick from the list, or type your town." : undefined}
            error={error("city")}
          >
            <input
              className="field"
              list="profile-cities"
              autoComplete="address-level2"
              {...form.register("city")}
            />
            <datalist id="profile-cities">
              {cities.map((city) => (
                <option key={city.slug} value={city.name} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Ground or address"
            hint="Where people find you, like Shivaji Park, Dadar."
            error={error("address")}
          >
            <input className="field" autoComplete="street-address" {...form.register("address")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email shown on your profile" error={error("contactEmail")}>
            <input
              className="field"
              type="email"
              autoComplete="email"
              {...form.register("contactEmail")}
            />
          </Field>
          <Field label="Phone, optional" hint="With the country code." error={error("phone")}>
            <input className="field" type="tel" autoComplete="tel" {...form.register("phone")} />
          </Field>
          <Field
            label="WhatsApp, optional"
            hint="Shows a WhatsApp button."
            error={error("whatsapp")}
          >
            <input className="field" type="tel" {...form.register("whatsapp")} />
          </Field>
          <Field label="Website, optional" error={error("website")}>
            <input
              className="field"
              type="url"
              placeholder="https://"
              {...form.register("website")}
            />
          </Field>
          <Field label="Instagram, optional" error={error("instagram")}>
            <input
              className="field"
              type="url"
              placeholder="https://instagram.com/…"
              {...form.register("instagram")}
            />
          </Field>
          <Field label="Facebook, optional" error={error("facebook")}>
            <input
              className="field"
              type="url"
              placeholder="https://facebook.com/…"
              {...form.register("facebook")}
            />
          </Field>
          <Field label="YouTube, optional" error={error("youtube")}>
            <input
              className="field"
              type="url"
              placeholder="https://youtube.com/…"
              {...form.register("youtube")}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold">
          Players and facilities
        </legend>
        <Chips
          label="Age groups, optional"
          name="ageGroups"
          options={AGE_GROUPS}
          register={(name) => form.register(name)}
        />
        <Chips
          label="Facilities, optional"
          name="facilities"
          options={FACILITIES}
          register={(name) => form.register(name)}
        />
      </fieldset>

      {slug ? (
        <input type="hidden" value="true" {...form.register("consent")} />
      ) : (
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            value="true"
            className="mt-0.5 h-5 w-5"
            {...form.register("consent")}
          />
          <span>
            I run this {country === "india" ? "club or academy" : "organisation"}, or I am allowed
            to list it. A moderator checks it once before it goes public.
          </span>
        </label>
      )}
      <Error message={error("consent") || serverErrors.form} />
      {saved ? (
        <p role="status" className="rounded-2xl bg-surface px-4 py-3 text-sm font-medium">
          {saved === "pending"
            ? "Saved. Your profile is waiting for its check."
            : "Saved. Your profile is updated."}
        </p>
      ) : null}
      <div>
        <button
          className="inline-flex min-h-12 items-center rounded-full bg-[#176B43] px-6 font-medium text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Saving" : slug ? "Save changes" : "Create my profile"}
        </button>
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

function Chips({
  label,
  name,
  options,
  register,
}: {
  label: string;
  name: "ageGroups" | "facilities";
  options: string[];
  register: (name: "ageGroups" | "facilities") => UseFormRegisterReturn;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm has-[:checked]:border-[#176B43]"
          >
            <input type="checkbox" value={option} {...register(name)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
