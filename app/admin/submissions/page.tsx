import Link from "next/link";
import { moderationSnapshot } from "@/lib/data/moderation";

export default async function SubmissionsPage() {
  const submissions = (await moderationSnapshot()).submissions;
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Submissions</h1>
      <ul className="mt-6 grid gap-3">
        {submissions.map((item) => (
          <li key={item.id}>
            <Link
              href={`/admin/submissions/${item.id}`}
              className="block rounded-2xl border border-line bg-surface p-4 no-underline"
            >
              <span className="font-medium capitalize">{item.entityType}</span>
              <span className="text-muted"> · {item.status.replaceAll("_", " ")}</span>
              <span className="mt-1 block text-sm text-muted">
                {item.submitterEmail || "No email"} · {new Date(item.createdAt).toUTCString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!submissions.length ? <p className="mt-4 text-muted">The queue is empty.</p> : null}
    </>
  );
}
