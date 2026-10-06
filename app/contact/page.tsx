import Link from "next/link";
import type { ReactNode } from "react";
import { Flag, Handshake, Mail, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { CONTACT_EMAIL } from "@/lib/company";
import { organizationJsonLd, pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

export const metadata = pageMetadata(
  "Contact us",
  "Write to cricketmatch.today about listing your club, a mistake on a match, a photo to take down, your data, or a partnership, and how to raise a grievance.",
  "/contact",
);

const link = "font-medium text-link underline underline-offset-4";

const TOPICS: { icon: typeof Mail; title: string; body: ReactNode }[] = [
  {
    icon: MapPin,
    title: "Listing your club or academy",
    body: (
      <>
        Create a free profile on{" "}
        <Link href="/get-listed" className={link}>
          Get listed
        </Link>
        . Stuck, or want us to check your fixture sheet? Email us your club&apos;s name and town.
      </>
    ),
  },
  {
    icon: Ticket,
    title: "A mistake on a match",
    body: "Use “Report incorrect details” on the match page, or email us the link to the match and what is wrong.",
  },
  {
    icon: Flag,
    title: "Report a listing or a photo",
    body: "If a profile is fake or misleading, uses your photos, or shows your child and you want it removed, email us the link to the page. Photos of children come down within 24 hours.",
  },
  {
    icon: ShieldCheck,
    title: "Your data",
    body: (
      <>
        Ask what we hold about you, or ask us to correct or delete it. To stop a ticket alert, use
        the link in its email. The{" "}
        <Link href="/legal/privacy" className={link}>
          Privacy policy
        </Link>{" "}
        has the details.
      </>
    ),
  },
  {
    icon: Handshake,
    title: "Boards, leagues, sellers and press",
    body: "Send us your official fixtures or ticket pages and we will link to them. Partnership ideas and press questions are welcome too.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact cricketmatch.today",
          url: `${siteUrl()}/contact`,
          mainEntity: organizationJsonLd(),
        }}
      />
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Contact</p>
      <h1 className="mt-2 max-w-3xl font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
        Talk to us
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        We are a small team and the founders read every message. Email is the best way to reach us,
        and we aim to reply within two working days.
      </p>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-8 inline-flex min-h-12 max-w-full items-center gap-2 rounded-full bg-[#176B43] px-6 text-[15px] font-medium text-white"
      >
        <Mail aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="truncate">{CONTACT_EMAIL}</span>
      </a>

      <section aria-labelledby="topics" className="mt-16">
        <h2 id="topics" className="font-display text-3xl font-extrabold">
          What can we help with?
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-[1.25rem] border border-line bg-surface p-5">
              <Icon aria-hidden="true" className="h-6 w-6 text-link" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="grievances"
        aria-labelledby="grievances-title"
        className="mt-16 scroll-mt-24 rounded-[1.25rem] border border-line bg-surface p-6 sm:p-8"
      >
        <h2 id="grievances-title" className="font-display text-3xl font-extrabold">
          Grievance team
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Our grievance team handles complaints about content on cricketmatch.today and about your
          personal data, as the Information Technology Act, 2000 and its rules require.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Who</dt>
            <dd className="font-semibold">Grievance team, cricketmatch.today</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted">Email</dt>
            <dd className="font-semibold break-words">
              <a href={`mailto:${CONTACT_EMAIL}?subject=Grievance`} className={link}>
                {CONTACT_EMAIL}
              </a>
            </dd>
          </div>
        </dl>
        <div className="prose-page mt-6 max-w-3xl">
          <p>
            Put &ldquo;Grievance&rdquo; in the subject, and tell us your name and how to reach you,
            the link to the page, what is wrong, and what you would like us to do. If you are
            complaining for someone else, say so.
          </p>
          <p>
            We acknowledge every complaint within 24 hours and resolve it within 15 days. Content
            that shows nudity or sexual acts, or impersonates someone, comes down within 24 hours of
            your complaint.
          </p>
          <p>
            If our decision does not satisfy you, you can appeal to the Grievance Appellate
            Committee at <a href="https://gac.gov.in">gac.gov.in</a> within 30 days. For complaints
            about your personal data, you can also go to the Data Protection Board of India.
          </p>
        </div>
      </section>

      <section aria-labelledby="where" className="mt-16 max-w-3xl">
        <h2 id="where" className="font-display text-3xl font-extrabold">
          Where we are
        </h2>
        <p className="mt-3 text-[17px] leading-7 text-muted">
          cricketmatch.today is run from India by its founders, Gagan and Vansh. We do not have an
          office open to visitors, so email is the way to reach us. Read more{" "}
          <Link href="/about" className={link}>
            about us
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
