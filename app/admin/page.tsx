import { RoleForm } from "@/components/admin/role-form";
import { moderationSnapshot } from "@/lib/data/moderation";
import { isStale } from "@/lib/domain/ticket-state";

export default async function AdminHome() {
  const queue = await moderationSnapshot();
  const now = new Date();
  const cards = [
    ["Pending submissions", queue.submissions.filter((item) => item.status === "pending").length],
    ["Ticket links waiting", queue.offers.filter((item) => item.offer.status === "pending").length],
    [
      "Corrections",
      queue.submissions.filter(
        (item) => item.entityType === "correction" && item.status === "pending",
      ).length,
    ],
    ["Stale fixtures", queue.matches.filter((match) => isStale(match.lastVerifiedAt, now)).length],
    ["Failed imports", queue.importRuns.filter((run) => run.status === "failed").length],
    ["Dead letters", queue.deadLetters.length],
  ];
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Moderation queue</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="font-display text-4xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      {queue.session?.role === "admin" ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">Roles</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The person must have signed in once. You cannot change your own role from this form. The
            first admin is still set in the SQL editor.
          </p>
          <RoleForm />
        </section>
      ) : null}
    </>
  );
}
