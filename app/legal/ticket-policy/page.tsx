import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Ticket policy",
  "How ticket links, alerts and seller domains are handled.",
  "/legal/ticket-policy",
);

export default function TicketPolicyPage() {
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4 px-5 py-12 text-[17px] leading-7">
      <h1 className="font-display text-5xl font-extrabold">Ticket policy</h1>
      <p>
        Every match has one attendance state: official link, authorised partner, alert, free entry,
        sold out, private, postponed or cancelled.
      </p>
      <p>
        A public ticket link must be HTTPS, must not be a shortener, and must be approved by a
        moderator. You see the seller name and domain before the site opens it. We do not publish an
        arbitrary URL that a visitor types into the address bar.
      </p>
      <p>
        A price is shown only when the approved seller supplied a currency and the figure was
        checked within the last seven days. Requesting an alert does not buy, hold or guarantee a
        ticket.
      </p>
      <p>
        We do not list fan-to-fan resale. Discovery feeds that mix resale or unknown sources are
        filtered and still require approval before anything is public.
      </p>
    </article>
  );
}
