import { demoRolesAllowed } from "@/lib/data/mode";
import { pageMetadata } from "@/lib/seo";
import { firstParam, safeNextPath } from "@/lib/utils";

export const metadata = pageMetadata("Check your email", "A sign-in link is on its way.", "/login/sent", false);

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const email = firstParam(params.email);
  const next = safeNextPath(firstParam(params.next));
  return (
    <div className="mx-auto w-full max-w-lg px-5 py-12">
      <h1 className="font-display text-4xl font-extrabold">Check your email</h1>
      <p className="mt-3 text-muted">
        {email ? `We sent a sign-in link to ${email}.` : "If that address can receive mail, a sign-in link is on the way."} The link expires in 30 minutes.
      </p>
      {demoRolesAllowed() && token ? (
        <p className="mt-6">
          <a className="font-medium text-link" href={`/login/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`}>
            Demo inbox: open the sign-in link
          </a>
        </p>
      ) : null}
    </div>
  );
}
