import { accountSnapshot } from "@/lib/data/account";
import { getSession } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Your account", "Alerts and submissions.", "/dashboard", false);

export default async function DashboardPage() {
  const session = await getSession();
  const account = session ? await accountSnapshot(session) : { submissions: [], alertCount: 0, academies: [] };
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Your account</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Your submissions</p>
          <p className="font-display text-4xl font-extrabold">{account.submissions.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Your ticket alerts</p>
          <p className="font-display text-4xl font-extrabold">{account.alertCount}</p>
        </div>
      </div>
    </>
  );
}
