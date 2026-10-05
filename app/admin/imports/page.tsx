import { moderationSnapshot } from "@/lib/data/moderation";

export default async function ImportsPage() {
  const queue = await moderationSnapshot();
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Imports</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        SportMonks runs only when SPORTMONKS_API_TOKEN is set. Rows land in Postgres inside an
        import run. Ticketmaster suggestions stay pending until a moderator approves them. The cron
        route is /api/cron/sync and requires CRON_SECRET.
      </p>
      <ul className="mt-6 grid gap-3">
        {queue.importRuns.map((run) => (
          <li key={run.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="font-medium">
              {run.provider} · {run.status}
            </p>
            <p className="text-muted">
              {run.startedAt} · fetched {run.fetchedCount} · conflicts {run.failedCount}
            </p>
            {run.errorSummary ? <p className="mt-2">{run.errorSummary}</p> : null}
          </li>
        ))}
      </ul>
      {!queue.importRuns.length ? <p className="mt-4 text-muted">No import has run yet.</p> : null}
      <h2 className="mt-8 font-display text-2xl font-bold">Dead letters</h2>
      <ul className="mt-3 text-sm">
        {queue.deadLetters.map((item) => (
          <li key={item.id}>
            {item.provider}: {item.reason}
          </li>
        ))}
      </ul>
    </>
  );
}
