import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

async function loadVenue(slug: string) {
  const directory = await getDirectory();
  const matches = directory.matches.filter((match) => match.venueSlug === slug);
  const venue = matches[0];
  return venue ? { venue, matches } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadVenue(slug);
  if (!loaded) notFound();
  const { venue, matches } = loaded;
  const summary = upcomingSummary(matches, new Date(), { grounds: false });
  return pageMetadata(
    `${venue.venueName}, ${venue.cityName}: fixtures and tickets`,
    summary
      ? `${summary} at ${venue.venueName}, ${venue.cityName}. Start times, how to get there and official ticket links.`
      : `Cricket at ${venue.venueName}, ${venue.cityName}: fixtures, directions and official ticket links.`,
    `/venues/${slug}`,
  );
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadVenue(slug);
  if (!loaded) notFound();
  const { venue, matches } = loaded;
  const summary = upcomingSummary(matches, new Date(), { grounds: false });
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.venueName}, ${venue.venueAddress}`)}`;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "Matches", path: "/matches" },
          { name: venue.countryName, path: `/country/${venue.countrySlug}` },
          ...(venue.countrySlug === "india" && venue.stateSlug && venue.stateName
            ? [{ name: venue.stateName, path: `/country/india/state/${venue.stateSlug}` }]
            : []),
          { name: venue.cityName, path: `/country/${venue.countrySlug}/${venue.citySlug}` },
          { name: venue.venueName, path: `/venues/${slug}` },
        ]}
      />
      <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-link uppercase">
        {venue.cityName}
      </p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{venue.venueName}</h1>
      <p className="mt-3 text-muted">{venue.venueAddress}</p>
      {summary ? <p className="mt-3 max-w-2xl font-medium">{summary}.</p> : null}
      <a
        className="mt-4 inline-flex min-h-11 items-center text-link"
        href={mapHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open map
      </a>
      <div className="mt-8">
        <MatchGrid matches={matches} now={new Date()} />
      </div>
    </div>
  );
}
