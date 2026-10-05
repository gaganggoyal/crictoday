import Link from "next/link";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Cricket matches by country",
  "Browse upcoming cricket in India, England, Australia and other listed countries.",
  "/countries",
);

export default async function CountriesPage() {
  const directory = await getDirectory();
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Places</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Countries</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {directory.countries.map((country) => {
          const count = directory.matches.filter(
            (match) => match.countrySlug === country.slug,
          ).length;
          return (
            <Link
              key={country.slug}
              href={`/country/${country.slug}`}
              className="rounded-[1.25rem] border border-line bg-surface p-5 no-underline"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                {country.iso2}
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold">{country.name}</h2>
              <p className="mt-2 text-sm text-muted">{country.blurb}</p>
              <p className="mt-3 text-sm font-medium">{count} listed matches</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
