import Link from "next/link";
import { DocPage, type DocSection } from "@/components/layout/doc-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Ticket policy",
  "How cricketmatch.today checks ticket links, shows prices and sends ticket alerts, and why it never lists resale.",
  "/legal/ticket-policy",
);

const SECTIONS: DocSection[] = [
  {
    id: "attendance",
    title: "One state for every match",
    body: (
      <p>
        Every match shows one attendance state: official link, authorised partner, alert, free
        entry, sold out, private, postponed or cancelled.
      </p>
    ),
  },
  {
    id: "links",
    title: "How ticket links are checked",
    body: (
      <ul>
        <li>A public ticket link must use HTTPS and must not be a link shortener.</li>
        <li>A moderator approves every link before it is shown.</li>
        <li>You see the seller&apos;s name and web address before the site opens the link.</li>
        <li>We never open an address that a visitor types into the address bar.</li>
      </ul>
    ),
  },
  {
    id: "prices",
    title: "Prices",
    body: (
      <p>
        A price is shown only when the approved seller gave a currency and the figure was checked
        within the last seven days. The seller&apos;s site always has the final price.
      </p>
    ),
  },
  {
    id: "alerts",
    title: "Ticket alerts",
    body: (
      <p>
        An alert sends one email when an approved ticket link is listed, then closes. Asking for an
        alert does not buy, hold or guarantee a ticket. The{" "}
        <Link href="/legal/privacy#ticket-alerts">Privacy policy</Link> explains what we store.
      </p>
    ),
  },
  {
    id: "resale",
    title: "No resale",
    body: (
      <p>
        We do not list fan-to-fan resale. Ticket feeds that mix in resale or unknown sellers are
        filtered, and anything left still needs approval before it is public.
      </p>
    ),
  },
];

export default function TicketPolicyPage() {
  return (
    <DocPage
      eyebrow="Legal"
      title="Ticket policy"
      intro={<p>How we check ticket links, show prices and send alerts.</p>}
      sections={SECTIONS}
    />
  );
}
