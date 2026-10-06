import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { getSession, isStaff } from "@/lib/auth/session";

const links = [
  ["/admin", "Overview"],
  ["/admin/profiles", "Profiles"],
  ["/admin/submissions", "Submissions"],
  ["/admin/ticket-links", "Ticket links"],
  ["/admin/corrections", "Corrections"],
  ["/admin/imports", "Imports"],
  ["/admin/audit", "Audit"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.role)) redirect("/dashboard");
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Moderation</p>
      <nav aria-label="Moderation" className="mt-3 flex flex-wrap gap-2">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
          >
            {label}
          </Link>
        ))}
        <form action={signOutAction}>
          <button
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
