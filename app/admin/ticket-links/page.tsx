import { PendingOffers } from "@/components/admin/review-controls";
import { moderationSnapshot } from "@/lib/data/moderation";

export default async function TicketLinksPage() {
  const offers = (await moderationSnapshot()).offers;
  const pending = offers.filter((item) => item.offer.status === "pending");
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Ticket links</h1>
      <p className="mt-2 text-sm text-muted">
        Approving a link makes it public and emails verified alerts. Blocked domains cannot be
        approved.
      </p>
      <PendingOffers items={pending} />
      <h2 className="mt-10 font-display text-2xl font-bold">Already decided</h2>
      <ul className="mt-3 grid gap-2 text-sm">
        {offers
          .filter((item) => item.offer.status !== "pending")
          .map(({ homeName, awayName, offer }) => (
            <li key={offer.id}>
              {offer.status === "active"
                ? "Approved"
                : offer.status === "sold_out"
                  ? "Sold out"
                  : offer.status}{" "}
              · {offer.sellerDomain} · {homeName} vs {awayName}
            </li>
          ))}
      </ul>
    </>
  );
}
