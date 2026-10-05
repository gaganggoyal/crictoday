import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { getSession, isStaff } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-sm text-muted">{session.email} · {session.role}</p>
      <nav aria-label="Account" className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link className="inline-flex min-h-11 items-center" href="/dashboard">Overview</Link>
        <Link className="inline-flex min-h-11 items-center" href="/dashboard/matches">Submissions</Link>
        <Link className="inline-flex min-h-11 items-center" href="/dashboard/academy">Academy</Link>
        {isStaff(session.role) ? <Link className="inline-flex min-h-11 items-center" href="/admin">Moderation</Link> : null}
        <form action={signOutAction}>
          <button className="inline-flex min-h-11 items-center" type="submit">Sign out</button>
        </form>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
