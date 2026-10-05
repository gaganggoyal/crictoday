import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { accountSnapshot } from "@/lib/data/account";

export default async function DashboardAcademyPage() {
  const session = await getSession();
  const owned = session ? (await accountSnapshot(session)).academies : [];
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Your academy</h1>
      <ul className="mt-6 grid gap-3">
        {owned.map((academy) => (
          <li key={academy.slug} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-medium">{academy.name}</p>
            <p className="text-sm text-muted">{academy.verificationLabel || academy.verificationStatus}</p>
            {academy.verificationStatus === "verified" ? (
              <Link href={`/academy/${academy.slug}`}>View public profile</Link>
            ) : null}
          </li>
        ))}
      </ul>
      {!owned.length ? (
        <p className="mt-4 text-muted">
          No academy is tied to this email. <Link href="/submit/academy">Submit one</Link>.
        </p>
      ) : null}
    </>
  );
}
