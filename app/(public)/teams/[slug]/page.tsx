import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MatchGrid } from "@/components/match/match-grid";
import { currentTime } from "@/lib/clock";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata, upcomingSummary } from "@/lib/seo";

async function loadTeam(slug: string) {
  const directory = await getDirectory();
  const matches = directory.matches.filter(
    (match) => match.homeSlug === slug || match.awaySlug === slug,
  );
  const first = matches[0];
  if (!first) return null;
  return { name: first.homeSlug === slug ? first.homeName : first.awayName, matches };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await loadTeam(slug);
  if (!team) notFound();
  const summary = upcomingSummary(team.matches, currentTime());
  return pageMetadata(
    `${team.name} fixtures and tickets`,
    summary
      ? `${team.name}: ${summary}. Start times, grounds and official ticket links.`
      : `${team.name} cricket fixtures, grounds and official ticket links.`,
    `/teams/${slug}`,
  );
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await loadTeam(slug);
  if (!team) notFound();
  const summary = upcomingSummary(team.matches, currentTime());
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
        <MatchGrid matches={team.matches} now={currentTime()} />
      </div>
    </div>
  );
}
