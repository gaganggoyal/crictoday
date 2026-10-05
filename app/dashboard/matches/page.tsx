import { getSession } from "@/lib/auth/session";
import { accountSnapshot } from "@/lib/data/account";

export default async function DashboardMatchesPage() {
  const session = await getSession();
  const submissions = session ? (await accountSnapshot(session)).submissions : [];
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Your submissions</h1>
      <ul className="mt-6 grid gap-3">
        {submissions.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-medium capitalize">{item.entityType} · {item.status.replaceAll("_", " ")}</p>
            <p className="text-sm text-muted">{new Date(item.createdAt).toUTCString()}</p>
            {item.reviewerNotes ? <p className="mt-2 text-sm">{item.reviewerNotes}</p> : null}
          </li>
        ))}
      </ul>
      {!submissions.length ? <p className="mt-4 text-muted">Nothing submitted with this email yet.</p> : null}
    </>
  );
}
