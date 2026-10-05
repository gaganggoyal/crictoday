import { notFound } from "next/navigation";
import { ReviewControls, VerifyButton } from "@/components/admin/review-controls";
import { moderationSnapshot } from "@/lib/data/moderation";
import { findDuplicateCandidates } from "@/lib/domain/duplicates";

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queue = await moderationSnapshot();
  const submission = queue.submissions.find((item) => item.id === id);
  if (!submission) notFound();
  const payload = submission.payload;
  const home = String(payload.homeTeam || "");
  const away = String(payload.awayTeam || "");
  const duplicates = home
    ? findDuplicateCandidates(
        queue.matches.map((match) => ({
          id: match.slug,
          home: match.homeName,
          away: match.awayName,
          venue: match.venueName,
          competition: match.competitionName,
          startsAt: match.startsAt,
        })),
        {
          home,
          away,
          venue: String(payload.venue || ""),
          competition: String(payload.competition || ""),
          startsAt: String(payload.startsAtUtc || payload.startsAt || ""),
        },
      )
    : [];
  const history = queue.audit.filter((entry) => entry.entityId === submission.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h1 className="font-display text-4xl font-extrabold">Review</h1>
        <p className="mt-2 text-sm text-muted capitalize">
          {submission.entityType} · {submission.status.replaceAll("_", " ")}
        </p>
        <dl className="mt-6 grid gap-3">
          {Object.entries(payload).map(([key, value]) => (
            <div
              key={key}
              className="grid gap-1 border-b border-line py-2 sm:grid-cols-[180px_1fr]"
            >
              <dt className="text-sm text-muted">{key}</dt>
              <dd className="break-words text-sm">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
        {typeof payload.sourceUrl === "string" ? (
          <p className="mt-4 text-sm">
            Open the source in a new tab. Organiser sites are not embedded here.{" "}
            <a href={payload.sourceUrl} target="_blank" rel="noopener noreferrer">
              {payload.sourceUrl}
            </a>
          </p>
        ) : null}
        <h2 className="mt-8 font-display text-2xl font-bold">Similar records</h2>
        <ul className="mt-3 text-sm">
          {duplicates.map((item) => (
            <li key={item.id}>{item.id}</li>
          ))}
          {!duplicates.length ? <li>No duplicate candidate inside the 12-hour window.</li> : null}
        </ul>
        <h2 className="mt-8 font-display text-2xl font-bold">Audit</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {history.map((entry) => (
            <li key={entry.id}>
              {entry.createdAt} · {entry.action} · {entry.actorEmail}
            </li>
          ))}
          {!history.length ? <li>No audit entries yet.</li> : null}
        </ul>
        {typeof payload.matchSlug === "string" ? (
          <div className="mt-4">
            <VerifyButton matchSlug={payload.matchSlug} />
          </div>
        ) : null}
      </div>
      <ReviewControls
        id={submission.id}
        mergeTargets={queue.matches.slice(0, 30).map((match) => ({
          slug: match.slug,
          label: `${match.homeName} vs ${match.awayName}`,
        }))}
      />
    </div>
  );
}
