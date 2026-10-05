import { countries } from "@/lib/data/seed";

export function SearchForm({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/matches" method="get" className={compact ? "grid gap-3" : "grid gap-3 rounded-[1.25rem] bg-surface p-3 shadow-lg sm:grid-cols-[1fr_180px_auto] sm:items-center"} role="search">
      <label className="grid gap-1 text-sm font-medium text-foreground">
        <span className="sr-only">Team, league, city or venue</span>
        <input
          className="field"
          name="q"
          placeholder="Team, league, city or venue"
          aria-label="Team, league, city or venue"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <span className="sr-only">Country</span>
        <select className="field" name="country" aria-label="Country" defaultValue="">
          <option value="">Any country</option>
          {countries.map((country) => (
            <option key={country.slug} value={country.slug}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
      <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#176B43] px-5 font-medium text-white hover:bg-[#105535]" type="submit">
        Search matches
      </button>
    </form>
  );
}
