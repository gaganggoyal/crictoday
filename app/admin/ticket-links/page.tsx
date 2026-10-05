import { OfferButton } from "@/components/admin/review-controls";
import { moderationSnapshot } from "@/lib/data/moderation";

export default async function TicketLinksPage() {
  const offers = (await moderationSnapshot()).offers;
  const pending = offers.filter((item) => item.offer.status === "pending");
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Ticket links</h1>
      <p className="mt-2 text-sm text-muted">Approving a link makes it public and emails verified alerts. Blocked domains cannot be approved.</p>
      <ul className="mt-6 grid gap-3">
        {pending.map(({ matchSlug, homeName, awayName, offer }) => (
          <li key={offer.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-medium">{homeName} vs {awayName}</p>
            <p className="text-sm">{offer.sellerName} · {offer.sellerDomain}</p>
            <p className="text-sm break-all text-muted">{offer.url}</p>
            <div className="mt-3">
              <OfferButton matchSlug={matchSlug} offerId={offer.id} />
            </div>
          </li>
        ))}
      </ul>
      {!pending.length ? <p className="mt-4 text-muted">No ticket links are waiting.</p> : null}
      <h2 className="mt-10 font-display text-2xl font-bold">Already decided</h2>
      <ul className="mt-3 grid gap-2 text-sm">
        {offers.filter((item) => item.offer.status !== "pending").map(({ homeName, awayName, offer }) => (
          <li key={offer.id}>
            {offer.status === "active" ? "Approved" : offer.status === "sold_out" ? "Sold out" : offer.status} · {offer.sellerDomain} · {homeName} vs {awayName}
          </li>
        ))}
      </ul>
    </>
  );
}
