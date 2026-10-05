import { moderationSnapshot } from "@/lib/data/moderation";

export default async function AuditPage() {
  const entries = (await moderationSnapshot()).audit;
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Audit</h1>
      <ul className="mt-6 grid gap-3">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="font-medium">{entry.action}</p>
            <p className="text-muted">{entry.createdAt} · {entry.actorEmail || "system"} · {entry.entityType}</p>
          </li>
        ))}
      </ul>
      {!entries.length ? <p className="mt-4 text-muted">No privileged actions recorded yet.</p> : null}
    </>
  );
}
