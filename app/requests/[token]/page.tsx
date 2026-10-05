import Link from "next/link";
import { openRequestTokenAction } from "@/app/actions";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata("Ticket alert", "Confirm or stop a ticket alert.", "/requests", false);

export default async function RequestTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const intent = firstParam((await searchParams).intent);
  const result = await openRequestTokenAction(token, intent);
  return (
    <div className="mx-auto w-full max-w-lg px-5 py-12">
      <h1 className="font-display text-4xl font-extrabold">
        {result.ok && result.intent === "unsubscribe" ? "Alert stopped" : result.ok ? "Alert confirmed" : "Link not valid"}
      </h1>
      <p className="mt-3 text-muted">
        {result.ok
          ? result.intent === "unsubscribe"
            ? "You will not get further email for that request."
            : "We will email you only if an approved offer becomes active. This does not reserve a seat."
          : result.errors.form}
      </p>
      {result.ok ? (
        <Link className="mt-6 inline-flex min-h-11 items-center text-link" href={`/match/${result.matchSlug}`}>
          Back to the match
        </Link>
      ) : null}
    </div>
  );
}
