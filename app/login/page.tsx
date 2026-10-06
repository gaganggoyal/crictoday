import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { LoginForm } from "@/components/forms/login-form";
import { getSession } from "@/lib/auth/session";
import { demoRolesAllowed } from "@/lib/data/mode";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata("Sign in", "Email a one-time sign-in link.", "/login", false);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = firstParam(params.next);
  const linkError = firstParam(params.error) === "link";
  const session = await getSession();
  if (session) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12">
        <h1 className="font-display text-4xl font-extrabold">You are signed in</h1>
        <p className="mt-3 text-sm text-muted">This browser is signed in as {session.email}.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
          >
            Your account
          </Link>
          <form action={signOutAction}>
            <button
              className="inline-flex min-h-11 items-center rounded-full border border-line px-5"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="font-display text-4xl font-extrabold">Sign in</h1>
      <p className="mt-3 text-sm text-muted">We email a link. There is no password.</p>
      {linkError ? (
        <p className="mt-4 text-sm" role="alert">
          That sign-in link is invalid or has expired.
        </p>
      ) : null}
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
      <p className="mt-4 text-sm text-muted">
        By signing in, you agree to our{" "}
        <Link href="/legal/terms" className="text-link underline underline-offset-4">
          Terms of use
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="text-link underline underline-offset-4">
          Privacy policy
        </Link>
        .
      </p>
      {demoRolesAllowed() ? (
        <aside className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          <p className="font-medium text-foreground">Demo roles</p>
          <p className="mt-1">
            admin@cricketmatch.today, moderator@cricketmatch.today, organiser@cricketmatch.today,
            academy@cricketmatch.today. Any other email is a fan.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
