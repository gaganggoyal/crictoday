import { RequestTokenForm } from "@/components/forms/request-token-form";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata(
  "Ticket alert",
  "Confirm or stop a ticket alert.",
  "/requests",
  false,
);

export default async function RequestTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const intent =
    firstParam((await searchParams).intent) === "unsubscribe" ? "unsubscribe" : "verify";
  return (
    <div className="mx-auto w-full max-w-lg px-5 py-12">
      <RequestTokenForm token={token} intent={intent} />
    </div>
  );
}
