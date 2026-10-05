import { notFound } from "next/navigation";
import { MatchGrid } from "@/components/match/match-grid";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const directory = await getDirectory();
  const match = directory.matches.find((item) => item.homeSlug === slug || item.awaySlug === slug);
  if (!match) notFound();
  const name = match.homeSlug === slug ? match.homeName : match.awayName;
  return pageMetadata(
    `${name} fixtures`,
    `Upcoming cricket for ${name}, with venue and ticket state.`,
    `/teams/${slug}`,
  );
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const directory = await getDirectory();
  const matches = directory.matches.filter(
    (match) => match.homeSlug === slug || match.awaySlug === slug,
  );
  if (!matches.length) notFound();
  const name = matches[0]!.homeSlug === slug ? matches[0]!.homeName : matches[0]!.awayName;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{name}</h1>
      <div className="mt-8">
        <MatchGrid matches={matches} now={new Date()} />
      </div>
    </div>
  );
}
