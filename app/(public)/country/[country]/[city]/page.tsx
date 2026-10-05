import { notFound } from "next/navigation";
import { EmptyResults, MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ country: string; city: string }> }) {
  const { country, city } = await params;
  const directory = await getDirectory();
  const sample = directory.matches.find((match) => match.countrySlug === country && match.citySlug === city);
  if (!sample) notFound();
  return pageMetadata(
    `Upcoming cricket matches in ${sample.cityName}`,
    `Fixtures, venues and ticket state for cricket in ${sample.cityName}, ${sample.countryName}.`,
    `/country/${country}/${city}`,
  );
}

export default async function CityPage({ params }: { params: Promise<{ country: string; city: string }> }) {
  const { country, city } = await params;
  const directory = await getDirectory();
  const matches = directory.matches.filter((match) => match.countrySlug === country && match.citySlug === city);
  if (!matches.length) notFound();
  const sample = matches[0]!;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{sample.countryName}</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Cricket in {sample.cityName}</h1>
      <div className="mt-8">
        {matches.length ? <MatchGrid matches={matches} now={new Date()} /> : <EmptyResults />}
      </div>
    </div>
  );
}
