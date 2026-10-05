import Link from "next/link";
import { getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Top cricket leagues and ticket links",
  "IPL, BBL, The Hundred, SA20 and CPL hubs with fixtures and ticket state.",
  "/leagues",
);

export default async function LeaguesPage() {
  const directory = await getDirectory();
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Leagues</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Top leagues</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {directory.leagues.map((league) => {
          const count = directory.matches.filter((match) => match.competitionSlug === league.slug).length;
          return (
            <Link key={league.slug} href={`/league/${league.slug}`} className="rounded-[1.25rem] border border-line bg-surface p-5 no-underline">
              <h2 className="font-display text-3xl font-extrabold">{league.name}</h2>
              <p className="mt-2 text-sm text-muted">{league.summary}</p>
              <p className="mt-3 text-sm font-medium">{league.seasonName} · {count} fixtures</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
