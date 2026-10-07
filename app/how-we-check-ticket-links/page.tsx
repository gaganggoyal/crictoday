import Link from "next/link";
import { DocPage, type DocSection } from "@/components/layout/doc-page";
import { CONTACT_EMAIL, TICKET_POLICY_UPDATED } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "How we check cricket ticket links",
  "What “official source” and “authorised seller” mean on cricketmatch.today, what a person checks before a ticket link goes live, and what we can’t promise.",
  "/how-we-check-ticket-links",
);

const STATES: [string, string][] = [
  ["Tickets available", "an official ticket link is approved for this match."],
  ["Authorised seller", "the organiser has authorised this seller for this match or series."],
  [
    "No official link yet",
    "the sale hasn’t opened, or we haven’t found an official link. You can ask for an alert.",
  ],
  ["Sold out", "the official seller says it’s sold out. You can join the update list."],
  ["Free entry", "the organiser says entry is free. The match page has the entry notes."],
  ["Private match", "the match isn’t open to the public."],
  ["Postponed", "the new date isn’t confirmed, so ticket links are paused."],
  ["Cancelled", "the match won’t be played, so ticket links and alerts are closed."],
  ["Under way", "the match has started, so ticket links and alerts are closed."],
  ["Finished", "the match is over."],
];

const SECTIONS: DocSection[] = [
  {
    id: "official-source",
    title: "What “official source” means",
    body: (
      <p>
        The board, league, tournament, club, ground or organiser’s own website or ticket system.
        Every match on cricketmatch.today names the source we took it from, and you can open it from
        the match page.
      </p>
    ),
  },
  {
    id: "authorised-seller",
    title: "What “authorised seller” means",
    body: (
      <p>
        A ticket company that the organiser names or links for that match or series. We approve a
        seller for that match or series, not for everything on its website: a company that sells one
        competition’s tickets is not approved for every cricket listing it carries.
      </p>
    ),
  },
  {
    id: "what-we-check",
    title: "What a person checks before a link goes live",
    body: (
      <ul>
        <li>
          The match is confirmed by its board, league, club or organiser, and the match page links
          that source.
        </li>
        <li>
          The ticket link comes from the organiser’s own page, or the organiser names the seller.
        </li>
        <li>The teams, date, ground and town match the organiser’s information.</li>
        <li>The link uses HTTPS and is not a link shortener.</li>
        <li>
          A moderator approves the link. Nothing from a ticket feed appears on the site on its own.
        </li>
      </ul>
    ),
  },
  {
    id: "before-you-leave",
    title: "Before you leave the site",
    body: (
      <p>
        A ticket button first opens a page on cricketmatch.today that names the seller and its
        domain, such as ticketgenie.in. You choose whether to continue. The button only ever opens
        the link we approved; it can’t be changed to send you anywhere else.
      </p>
    ),
  },
  {
    id: "how-often",
    title: "How often we check",
    body: (
      <p>
        Every match shows when we last checked it. A match we haven’t checked for seven days says
        so, so you know to confirm it with the organiser. A person updates sold-out states and new
        ticket links from the organisers’ pages; nothing is fetched automatically.
      </p>
    ),
  },
  {
    id: "states",
    title: "What each ticket state means",
    body: (
      <ul>
        {STATES.map(([label, meaning]) => (
          <li key={label}>
            <strong>{label}:</strong> {meaning}
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "changes",
    title: "When a link changes or closes",
    body: (
      <p>
        Ticket links close when a match starts. A postponed match’s links are paused until a new
        date is confirmed, and a cancelled match shows none. If a link stops working or the
        organiser changes seller, tell us and we check it.
      </p>
    ),
  },
  {
    id: "prices",
    title: "Prices",
    body: (
      <p>
        We show a price only when the approved seller gave a currency and we checked the figure in
        the last seven days. The seller’s site always has the final price.
      </p>
    ),
  },
  {
    id: "alerts",
    title: "Ticket alerts",
    body: (
      <p>
        An alert sends one email when an approved ticket link is listed, then closes. Asking for an
        alert doesn’t buy, hold or guarantee a ticket. The{" "}
        <Link href="/legal/privacy#ticket-alerts">Privacy policy</Link> explains what we store.
      </p>
    ),
  },
  {
    id: "resale",
    title: "No resale",
    body: (
      <p>
        We don’t list fan-to-fan resale or unknown sellers. Ticket feeds that mix them in are
        filtered, and anything left still needs a person’s approval before it appears.
      </p>
    ),
  },
  {
    id: "limits",
    title: "What we can’t promise",
    body: (
      <p>
        We don’t sell or issue tickets, and we don’t take payments. We can’t guarantee availability,
        prices, authenticity or entry, and a seller’s page can change after we check it. Always
        confirm the match details and the seller’s terms before you pay. The{" "}
        <Link href="/legal/terms#tickets">Terms of use</Link> have the details.
      </p>
    ),
  },
  {
    id: "report",
    title: "Report a problem",
    body: (
      <p>
        Use “Report incorrect details” on the match page, or email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the link to the match and what
        is wrong.
      </p>
    ),
  },
];

export default function HowWeCheckTicketLinksPage() {
  return (
    <DocPage
      eyebrow="Ticket policy"
      title="How we check cricket ticket links"
      intro={
        <p>
          cricketmatch.today helps you find a cricket match and the official place to buy a ticket.
          We don’t sell tickets: we check where each link goes and show you before you leave. Here
          is what we check, and what we can’t promise.
        </p>
      }
      updated={TICKET_POLICY_UPDATED}
      sections={SECTIONS}
    />
  );
}
