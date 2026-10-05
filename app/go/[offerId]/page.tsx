import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDirectory } from "@/lib/data/catalog";
import { dataMode } from "@/lib/data/mode";
import { serviceRecordClick } from "@/lib/data/service-writes";
import { readStore, writeStore } from "@/lib/data/store";
import { recordClick } from "@/lib/domain/workflows";
import { pageMetadata } from "@/lib/seo";
import { track } from "@/lib/analytics/track";

export const metadata = pageMetadata(
  "Leaving cricketmatch.today",
  "Review the seller domain before you continue.",
  "/go",
  false,
);

export default async function GoPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const directory = await getDirectory();
  const match = directory.matches.find((item) =>
    item.offers.some(
      (offer) => offer.id === offerId && offer.approved && offer.status === "active",
    ),
  );
  const offer = match?.offers.find((item) => item.id === offerId);
  if (!match || !offer) notFound();

  if (dataMode() === "demo") {
    const result = recordClick(readStore(), { offerId, referrer: null }, new Date());
    if (result.ok) writeStore(result.store);
  }
  if (dataMode() === "supabase") {
    const headerStore = await headers();
    const logged = await serviceRecordClick(offerId, headerStore.get("referer"));
    if (!logged.ok) console.error(logged.errors.form);
  }
  await track("ticket_offer_clicked", { offerId, domain: offer.sellerDomain });

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">You are leaving</p>
      <h1 className="font-display text-4xl font-extrabold">Check the seller before you continue</h1>
      <dl className="mt-6 grid gap-3 rounded-[1.25rem] border border-line bg-surface p-5">
        <div>
          <dt className="text-sm text-muted">Match</dt>
          <dd className="font-medium">
            {match.homeName} vs {match.awayName}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Seller</dt>
          <dd className="font-medium">{offer.sellerName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Domain</dt>
          <dd className="font-medium">{offer.sellerDomain}</dd>
        </div>
      </dl>
      {match.demo ? (
        <p className="mt-4 text-sm text-muted">
          Demo inventory: this link is illustrative. It does not sell a real ticket.
        </p>
      ) : null}
      <a
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-5 font-medium text-white"
      >
        Continue to {offer.sellerDomain}
      </a>
    </div>
  );
}
