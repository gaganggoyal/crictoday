import Link from "next/link";
import { ListYoursCallout, ProfileGrid } from "@/components/profile/profile-card";
import { getDirectory } from "@/lib/data/catalog";
import { INDIA_STATES, indiaState, placeState } from "@/lib/data/india";
import { PROFILE_KIND_PLURAL, PROFILE_KINDS } from "@/lib/domain/profiles";
import type { ProfileKind } from "@/lib/domain/types";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata(
  "Cricket clubs, academies and grounds",
  "Find cricket academies, clubs, committees and grounds near you, with their coaching, camps, ground hire and matches.",
  "/academies",
);

export default async function AcademiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const asked = firstParam(raw.kind);
  const kind = PROFILE_KINDS.includes(asked as ProfileKind) ? (asked as ProfileKind) : undefined;
  const country = firstParam(raw.country) || undefined;
  const state = country === "india" || !country ? indiaState(firstParam(raw.state)) : null;
  const directory = await getDirectory();
  const profiles = directory.academies.filter(
    (profile) =>
      (!kind || profile.kind === kind) &&
      (!country || profile.countrySlug === country) &&
      (!state || placeState(profile)?.slug === state.slug),
  );
  const heading = kind ? PROFILE_KIND_PLURAL[kind] : "Clubs, academies and grounds";
  const where = state?.name ?? directory.countries.find((item) => item.slug === country)?.name;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Local cricket</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        {heading}
        {where ? ` in ${where}` : ""}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Every profile here was checked by a moderator. Each lists its offers, contact details and
        upcoming matches.
      </p>
      <nav aria-label="Kinds" className="mt-6 flex flex-wrap gap-2">
        {[undefined, ...PROFILE_KINDS].map((item) => {
          const params = new URLSearchParams();
          if (item) params.set("kind", item);
          if (country) params.set("country", country);
          if (state) params.set("state", state.slug);
          const query = params.toString();
          return (
            <Link
              key={item ?? "all"}
              href={`/academies${query ? `?${query}` : ""}`}
              aria-current={item === kind ? "page" : undefined}
              className={
                item === kind
                  ? "inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-4 text-sm font-medium text-white"
                  : "inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm"
              }
            >
              {item ? PROFILE_KIND_PLURAL[item] : "All"}
            </Link>
          );
        })}
      </nav>
      <form action="/academies" method="get" className="mt-4 flex flex-wrap gap-3">
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <label className="text-sm font-medium">
          <span className="sr-only">Country</span>
          <select className="field" name="country" defaultValue={country || ""}>
            <option value="">All countries</option>
            {directory.countries.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="sr-only">State in India</span>
          <select className="field" name="state" defaultValue={state?.slug || ""}>
            <option value="">Any state in India</option>
            {INDIA_STATES.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white">
          Filter
        </button>
      </form>
      <div className="mt-8">
        {profiles.length ? (
          <ProfileGrid profiles={profiles} />
        ) : (
          <p className="text-muted">Nothing is listed here yet.</p>
        )}
      </div>
      <div className="mt-10">
        <ListYoursCallout place={where ?? "your town"} />
      </div>
    </div>
  );
}
