import Link from "next/link";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Cricket academies",
  "Academies with a checked contact, age groups and upcoming fixtures.",
  "/academies",
);

export default async function AcademiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const country = typeof raw.country === "string" ? raw.country : undefined;
  const directory = await getDirectory();
  const academies = directory.academies.filter((academy) => !country || academy.countrySlug === country);
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Academies</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Find an academy</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Public profiles show a precise verification label. Unchecked submissions stay off this list.
      </p>
      <form action="/academies" method="get" className="mt-6 flex flex-wrap gap-3">
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
        <button className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white">Filter</button>
      </form>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {academies.map((academy) => (
          <Link key={academy.slug} href={`/academy/${academy.slug}`} className="rounded-[1.25rem] border border-line bg-surface p-5 no-underline">
            <p className="text-xs font-semibold tracking-[0.14em] text-link uppercase">{academy.verificationLabel}</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">{academy.name}</h2>
            <p className="mt-2 text-sm text-muted">
              {academy.cityName}, {academy.countryName}
            </p>
            <p className="mt-2 text-sm">{academy.ageGroups.join(" · ")}</p>
          </Link>
        ))}
      </div>
      {!academies.length ? <p className="mt-8">No verified academies match that filter.</p> : null}
    </div>
  );
}
