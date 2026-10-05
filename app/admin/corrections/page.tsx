import Link from "next/link";
import { moderationSnapshot } from "@/lib/data/moderation";

export default async function CorrectionsPage() {
  const items = (await moderationSnapshot()).submissions.filter((item) => item.entityType === "correction");
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Corrections</h1>
      <ul className="mt-6 grid gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/admin/submissions/${item.id}`} className="block rounded-2xl border border-line bg-surface p-4">
              {item.status} · {String(item.payload.matchSlug || "")}
              <span className="mt-1 block text-sm text-muted">{String(item.payload.details || "")}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="mt-4 text-muted">No correction reports.</p> : null}
    </>
  );
}
