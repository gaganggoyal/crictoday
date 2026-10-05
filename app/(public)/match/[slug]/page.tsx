import Link from "next/link";
import { notFound } from "next/navigation";
import { CorrectionForm } from "@/components/forms/correction-form";
import { MatchGrid } from "@/components/match/match-grid";
import { TicketBadge } from "@/components/match/ticket-badge";
import { ShareButton, VisitorTime } from "@/components/match/visitor-time";
import { TicketPanel } from "@/components/ticket/ticket-panel";
import { getDirectory, getMatch } from "@/lib/data/catalog";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/domain/labels";
import { isStale, resolveAttendance } from "@/lib/domain/ticket-state";
import { formatInTimeZone } from "@/lib/domain/time";
import { jsonLdScript, pageMetadata, sportsEventJsonLd } from "@/lib/seo";
import { track } from "@/lib/analytics/track";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const match = await getMatch(slug);
  if (!match) notFound();
  return pageMetadata(
    `${match.homeName} vs ${match.awayName} tickets, date and venue`,
    `${match.competitionName} at ${match.venueName}, ${match.cityName}. Ticket state, source and last verification are on this page.`,
    `/match/${match.slug}`,
  );
}

export default async function MatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const match = await getMatch(slug);
  if (!match) notFound();
  const now = new Date();
  const directory = await getDirectory();
  const related = directory.matches
    .filter(
      (item) =>
        item.slug !== match.slug &&
        (item.citySlug === match.citySlug || item.competitionSlug === match.competitionSlug),
    )
    .slice(0, 3);
  const state = resolveAttendance(match, match.offers);
  const stale = isStale(match.lastVerifiedAt, now);
  const jsonLd = sportsEventJsonLd(match);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${match.venueName}, ${match.venueAddress}`)}`;
  await track("match_viewed", { slug: match.slug, state });

  return (
    <article className="mx-auto w-full max-w-[1120px] px-5 py-8">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      ) : null}
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/matches">Matches</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/country/${match.countrySlug}`}>{match.countryName}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/country/${match.countrySlug}/${match.citySlug}`}>{match.cityName}</Link>
          </li>
        </ol>
      </nav>
      {(state === "CANCELLED" || state === "POSTPONED") && (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 font-semibold text-white ${state === "CANCELLED" ? "bg-[#8C2F1B]" : "bg-[#8A5A12]"}`}
        >
          {state === "CANCELLED"
            ? "This match is cancelled. Ticket actions are closed."
            : "This match is postponed. The previous date should not be used for travel."}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <TicketBadge state={state} />
        <span className="text-sm text-muted">{FORMAT_LABEL[match.format]}</span>
        {match.demo ? (
          <span className="rounded-full border border-line px-2 py-1 text-xs font-semibold">
            DEMO
          </span>
        ) : null}
      </div>
      <h1 className="mt-3 max-w-4xl font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
        {match.homeName} vs {match.awayName}
      </h1>
      <p className="mt-3 text-lg text-muted">{match.competitionName}</p>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <dl className="grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Ground time</dt>
              <dd className="font-medium">{formatInTimeZone(match.startsAt, match.timezone)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Status</dt>
              <dd className="font-medium">{STATUS_LABEL[match.status]}</dd>
            </div>
            <div className="sm:col-span-2">
              <VisitorTime iso={match.startsAt} />
            </div>
            <div>
              <dt className="text-sm text-muted">Venue</dt>
              <dd className="font-medium">
                <Link href={`/venues/${match.venueSlug}`}>{match.venueName}</Link>
                <span className="mt-1 block text-sm font-normal text-muted">
                  {match.venueAddress}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Source</dt>
              <dd className="font-medium">
                {match.sourceLabel}
                {match.sourceUrl ? (
                  <a className="mt-1 block text-sm font-normal text-link" href={match.sourceUrl}>
                    View source
                  </a>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Last verified</dt>
              <dd className="font-medium">
                {match.lastVerifiedAt
                  ? new Date(match.lastVerifiedAt).toUTCString()
                  : "Not verified"}
              </dd>
            </div>
          </dl>
          {stale ? (
            <p
              className="rounded-2xl border border-warning bg-surface px-4 py-3 text-sm"
              role="status"
            >
              This listing is older than seven days. Treat the ticket state as unverified until the
              date changes.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium"
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open map
            </a>
            {state === "CANCELLED" || state === "POSTPONED" ? null : (
              <a
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium"
                href={`/match/${match.slug}/calendar`}
              >
                Add to calendar
              </a>
            )}
            <ShareButton title={`${match.homeName} vs ${match.awayName}`} />
          </div>
          <section>
            <h2 className="font-display text-2xl font-extrabold">Report a correction</h2>
            <div className="mt-3">
              <CorrectionForm matchSlug={match.slug} />
            </div>
          </section>
        </div>
        <TicketPanel match={match} now={now} />
      </div>
      {related.length ? (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-3xl font-extrabold">Related matches</h2>
          <MatchGrid matches={related} now={now} />
        </section>
      ) : null}
    </article>
  );
}
