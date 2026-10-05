import { notFound } from "next/navigation";
import { MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const directory = await getDirectory();
  const match = directory.matches.find((item) => item.venueSlug === slug);
  if (!match) notFound();
  return pageMetadata(
    `${match.venueName} cricket fixtures`,
    `Upcoming matches at ${match.venueName}, ${match.cityName}.`,
    `/venues/${slug}`,
  );
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const directory = await getDirectory();
  const matches = directory.matches.filter((match) => match.venueSlug === slug);
  if (!matches.length) notFound();
  const venue = matches[0]!;
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.venueName}, ${venue.venueAddress}`)}`;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{venue.cityName}</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{venue.venueName}</h1>
      <p className="mt-3 text-muted">{venue.venueAddress}</p>
      <a className="mt-4 inline-flex min-h-11 items-center text-link" href={mapHref} target="_blank" rel="noopener noreferrer">
        Open map
      </a>
      <div className="mt-8">
        <MatchGrid matches={matches} now={new Date()} />
      </div>
    </div>
  );
}
