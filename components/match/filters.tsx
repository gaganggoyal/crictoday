import Link from "next/link";
import { MoreFilters } from "@/components/match/more-filters";
import { filtersToQuery, type MatchFilters } from "@/lib/domain/filters";
import { FORMAT_LABEL, KIND_LABEL } from "@/lib/domain/labels";

export function MatchFiltersForm({
  filters,
  countries,
  cities,
}: {
  filters: MatchFilters;
  countries: Array<{ slug: string; name: string }>;
  cities: Array<{ slug: string; name: string; countrySlug: string }>;
}) {
  return (
    <form
      action="/matches"
      method="get"
      className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-4 lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Filters</h2>
        <Link href="/matches" className="text-sm font-medium text-link">
          Clear
        </Link>
      </div>
      <Field label="Search" name="q" defaultValue={filters.q} placeholder="Team, ground, league" />
      <MoreFilters active={activeFilters(filters)}>
        <Select
          label="Country"
          name="country"
          defaultValue={filters.country}
          options={countries.map((country) => [country.slug, country.name])}
        />
        <Select
          label="City"
          name="city"
          defaultValue={filters.city}
          options={cities.map((city) => [city.slug, city.name])}
        />
        <Field label="From" name="from" type="date" defaultValue={filters.from} />
        <Field label="To" name="to" type="date" defaultValue={filters.to} />
        <Select
          label="Competition"
          name="kind"
          defaultValue={filters.kind}
          options={Object.entries(KIND_LABEL)}
        />
        <Select
          label="Format"
          name="format"
          defaultValue={filters.format}
          options={Object.entries(FORMAT_LABEL)}
        />
        <Select
          label="Ticket state"
          name="tickets"
          defaultValue={filters.tickets}
          options={[
            ["official", "Tickets available"],
            ["partner", "Authorised partner"],
            ["alert", "Sale not open"],
            ["free", "Free entry"],
            ["sold_out", "Sold out"],
            ["private", "Private"],
            ["postponed", "Postponed"],
            ["cancelled", "Cancelled"],
          ]}
        />
        <Select
          label="Sort"
          name="sort"
          defaultValue={filters.sort}
          options={[
            ["featured", "Featured"],
            ["soonest", "Soonest"],
            ["verified", "Recently verified"],
            ["tickets", "Ticket availability"],
          ]}
          includeBlank={false}
        />
      </MoreFilters>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#176B43] px-5 font-medium text-white"
        type="submit"
      >
        Apply filters
      </button>
      <p className="hidden text-xs text-muted lg:block">
        Filter links stay in the address bar, so a result can be shared or crawled.
      </p>
    </form>
  );
}

/** Filters set besides the search box, for the count on the folded filters. */
function activeFilters(filters: MatchFilters) {
  const set = [
    filters.country,
    filters.city,
    filters.from,
    filters.to,
    filters.kind,
    filters.format,
  ];
  return [...set, filters.tickets].filter(Boolean).length + (filters.sort !== "featured" ? 1 : 0);
}

export function filterHref(filters: MatchFilters, overrides: Partial<MatchFilters> = {}) {
  return `/matches${filtersToQuery(filters, overrides)}`;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input
        className="field"
        name={name}
        type={type}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  includeBlank = true,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: string[][];
  includeBlank?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select className="field" name={name} defaultValue={defaultValue || ""}>
        {includeBlank ? <option value="">Any</option> : null}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
