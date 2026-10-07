import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid, NothingListedYet } from "@/components/match/match-grid";
import { currentTime } from "@/lib/clock";
import { getDirectory } from "@/lib/data/catalog";
import { matchesToCome } from "@/lib/domain/filters";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

/** A team with any listed match has a page; it shows the matches still to come. */
async function loadTeam(slug: string) {
  const directory = await getDirectory();
  const matches = directory.matches.filter(
    (match) => match.homeSlug === slug || match.awaySlug === slug,
  );
  const first = matches[0];
  if (!first) return null;
  const now = currentTime();
  return {
    name: first.homeSlug === slug ? first.homeName : first.awayName,
    matches: matchesToCome(matches, now),
    now,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await loadTeam(slug);
  if (!team) notFound();
  const summary = upcomingSummary(team.matches, team.now);
  return pageMetadata(
    `${team.name} fixtures and tickets`,
    summary
      ? `${team.name}: ${summary}. Start times, grounds and official ticket links.`
      : `${team.name} cricket fixtures, grounds and official ticket links.`,
    `/teams/${slug}`,
    // With nothing to come the page is thin, so it stays out of search until new fixtures arrive.
    team.matches.length > 0,
  );
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await loadTeam(slug);
  if (!team) notFound();
  const summary = upcomingSummary(team.matches, team.now);
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "Matches", path: "/matches" },
          { name: team.name, path: `/teams/${slug}` },
        ]}
      />
      <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-link uppercase">Team</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{team.name}</h1>
      {summary ? <p className="mt-3 max-w-2xl font-medium">{summary}.</p> : null}
      <div className="mt-8">
        {team.matches.length ? (
          <MatchGrid matches={team.matches} now={team.now} />
        ) : (
          <NothingListedYet title={`No upcoming ${team.name} matches listed`} />
        )}
      </div>
    </div>
  );
}
