import Link from "next/link";
import { DocPage, type DocSection } from "@/components/layout/doc-page";
import { CONTACT_EMAIL, POLICIES_UPDATED } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Terms of use",
  "The rules for using cricketmatch.today: match information, ticket links, accounts, listing a club or academy, what you may post, and how to complain.",
  "/legal/terms",
);

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const SECTIONS: DocSection[] = [
  {
    id: "agreement",
    title: "These terms",
    body: (
      <>
        <p>
          These terms are the agreement between you and cricketmatch.today, which is run from India
          by its founders, Gagan and Vansh (&ldquo;we&rdquo;, &ldquo;us&rdquo;). They apply whenever
          you use cricketmatch.today: when you browse, sign in, ask for a ticket alert or list a
          club.
        </p>
        <p>
          Our <Link href="/legal/privacy">Privacy policy</Link> and{" "}
          <Link href="/legal/ticket-policy">Ticket policy</Link> are part of these terms. If you do
          not agree with them, please do not use the site.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What cricketmatch.today is",
    body: (
      <>
        <p>
          cricketmatch.today helps you find cricket to watch and play, from internationals and top
          leagues to local clubs, academies and tournaments, and points you to the official way in.
        </p>
        <ul>
          <li>
            We are not a box office. We do not sell tickets, take bookings or handle payments, and
            we do not run a resale market.
          </li>
          <li>
            We do not organise the matches we list, run the academies and clubs, or employ their
            coaches.
          </li>
          <li>
            We are independent. We are not affiliated with or endorsed by the BCCI, the ICC, or any
            cricket board, league, team or ticket seller. Their names are used only to say which
            match is which, and they belong to their owners.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "match-information",
    title: "Match information",
    body: (
      <>
        <p>
          International and league fixtures come from the boards&apos; and organisers&apos; own
          pages. Local matches come from the clubs and organisers who post them. Each match page
          shows its source and when it was last checked.
        </p>
        <p>
          Dates, times, grounds and teams can change at short notice, and matches can be postponed,
          moved or called off. Rain is part of cricket. Always check with the official source before
          you travel or pay.
        </p>
      </>
    ),
  },
  {
    id: "tickets",
    title: "Ticket links and alerts",
    body: (
      <ul>
        <li>
          Ticket links go to official sellers or their authorised partners. A person checks every
          link before it is shown, and we show you the seller&apos;s name and web address before you
          leave our site.
        </li>
        <li>
          When you buy, you deal with the seller on their terms. Prices, availability, delivery,
          cancellations and refunds are theirs to handle. We are not a party to your purchase.
        </li>
        <li>
          A ticket alert is one email when an official link appears. It does not reserve, hold or
          guarantee a ticket.
        </li>
        <li>Any price we show is a guide. The seller&apos;s site has the final price.</li>
      </ul>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>
          You sign in with a link sent to your email address, so keep your email account safe.
          Anyone who can read your email can sign in as you.
        </li>
        <li>You must be 18 or over to have an account. Use your own email address.</li>
        <li>
          You are responsible for what is done through your account. Tell us at once if you think
          someone else has used it.
        </li>
      </ul>
    ),
  },
  {
    id: "listings",
    title: "Listing a club, academy, committee or ground",
    body: (
      <>
        <p>When you create a profile, you confirm that:</p>
        <ul>
          <li>you run the organisation, or it has allowed you to list it;</li>
          <li>
            what you publish is true, current and yours to publish, including phone numbers, email
            addresses and photos;
          </li>
          <li>
            you will keep it up to date, and mark matches postponed or cancelled when plans change;
          </li>
          <li>
            you are responsible for what you offer, such as coaching, camps, trials, fees and
            events, and for your dealings with the people who contact you.
          </li>
        </ul>
        <p>
          A moderator checks each new profile once before it goes public. The &ldquo;Contact
          verified&rdquo; badge means we confirmed that the contact details belonged to the listing
          when we checked. It is not a review or an endorsement of coaching, facilities, safety,
          fees or results.
        </p>
        <p>
          We may tidy a listing&apos;s formatting, ask you to change it, or hide or remove a
          profile, match or picture that breaks these terms, that is reported to us and found to be
          a problem, or that the law requires us to remove.
        </p>
        <p>
          Listing is free. If we ever add paid features, we will tell you first, and you will never
          be charged for something you did not agree to.
        </p>
      </>
    ),
  },
  {
    id: "rules",
    title: "What you must not post",
    body: (
      <>
        <p>You must not post, upload, share or link to anything that:</p>
        <ol>
          <li>
            belongs to someone else when you do not have the right to use it, such as photos, logos
            or text;
          </li>
          <li>
            is obscene, pornographic or paedophilic, or invades anyone&apos;s privacy, including
            bodily privacy;
          </li>
          <li>
            insults or harasses anyone on the basis of gender, or is racially or ethnically
            objectionable;
          </li>
          <li>
            relates to or encourages money laundering, gambling or betting, including cricket
            betting, or advertises online money games;
          </li>
          <li>
            promotes enmity between groups on the grounds of religion or caste with the intent to
            incite violence;
          </li>
          <li>is harmful to children;</li>
          <li>infringes any patent, trademark, copyright or other proprietary right;</li>
          <li>
            deceives or misleads anyone about where a message comes from, or knowingly shares
            information that is patently false or misleading;
          </li>
          <li>impersonates another person or organisation;</li>
          <li>
            threatens the unity, integrity, defence, security or sovereignty of India, its friendly
            relations with other countries or public order, incites any offence, prevents the
            investigation of any offence, or insults another nation;
          </li>
          <li>
            contains a virus or any other code meant to interrupt, damage or misuse a computer or
            service;
          </li>
          <li>breaks any law in force in India.</li>
        </ol>
        <p>Because this is a cricket site, three more rules:</p>
        <ul>
          <li>
            <strong>No fake trials.</strong> Do not promise places in teams, leagues or state or
            national squads that you cannot give, or charge for trials that do not lead where you
            say they do.
          </li>
          <li>
            <strong>Children&apos;s photos need permission.</strong> Get the consent of a parent or
            guardian before you post a photo of anyone under 18.
          </li>
          <li>
            <strong>No other people&apos;s details.</strong> Do not post anyone&apos;s phone number,
            address or other personal details without their permission.
          </li>
        </ul>
        <p>
          If you break these rules, we may remove the content at once, suspend or close your
          account, and report it to the authorities where the law requires.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <p>
        You own what you post. By posting it, you allow us to host, store, copy, resize, display and
        share it, for example in search results and link previews, to run and promote
        cricketmatch.today. This permission is free, worldwide and non-exclusive. It ends when you
        remove the content, except for copies in our backups and pages that people have already
        shared. You confirm that you have the right to give us this permission.
      </p>
    ),
  },
  {
    id: "fair-use",
    title: "Using the site fairly",
    body: (
      <>
        <p>Please do not:</p>
        <ul>
          <li>
            try to get into accounts, servers or data that are not yours, or get around our checks
            or limits;
          </li>
          <li>overload or disrupt the site, or use bots to send forms;</li>
          <li>
            copy large parts of the site or its listings into another service without our written
            permission;
          </li>
          <li>use contact details from listings to send spam or unwanted marketing.</li>
        </ul>
        <p>
          If you find a security problem, tell us at {mail}, and give us a chance to fix it before
          you tell anyone else.
        </p>
      </>
    ),
  },
  {
    id: "our-content",
    title: "Our name and content",
    body: (
      <p>
        The cricketmatch.today name, logo and design, and the text we write, belong to us. You are
        welcome to link to and share any page. Listings belong to the clubs and organisers who wrote
        them.
      </p>
    ),
  },
  {
    id: "no-guarantees",
    title: "What we cannot promise",
    body: (
      <>
        <p>
          We work hard to keep cricketmatch.today accurate and running, but we provide it &ldquo;as
          is&rdquo;. We cannot promise that every detail is right or current, that the site will
          always be available, or that a listed club, academy, coach, seller or event is suitable,
          safe or as described.
        </p>
        <p>
          Before you pay a fee, join a trial or send a child to an academy, visit it, ask questions
          and check for yourself.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limits on our liability",
    body: (
      <>
        <p>As far as Indian law allows:</p>
        <ul>
          <li>
            we are not liable for indirect or consequential losses, such as travel costs, missed
            matches or lost profits;
          </li>
          <li>
            we are not liable for what others post or do, including clubs, academies, organisers and
            ticket sellers;
          </li>
          <li>our total liability to you for any claim about the site is limited to ₹1,000.</li>
        </ul>
        <p>
          Nothing in these terms limits a liability that the law does not allow us to limit, or your
          rights as a consumer. If a claim is made against us because of something you posted or
          because you broke these terms, you agree to cover our reasonable costs.
        </p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Suspending and ending",
    body: (
      <p>
        You can stop using cricketmatch.today at any time, and ask us to delete your account and
        profiles. We may suspend or close an account, or remove a listing, if you break these terms,
        if the law requires it, or to protect other people. Where it is reasonable, we will tell you
        why and let you reply. We may change or close any part of the site, and will give notice on
        the site where we can.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms as the site grows. When we do, we will change the date at the top,
        and if a change matters to profile owners, we will email them before it takes effect. Using
        the site after a change means you accept the new terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    body: (
      <p>
        These terms are governed by the laws of India. If something goes wrong, please write to us
        first: most problems are solved quickly that way. A dispute that cannot be settled will be
        decided by the courts in India.
      </p>
    ),
  },
  {
    id: "grievances",
    title: "Grievances",
    body: (
      <>
        <p>
          Under the Information Technology Act, 2000 and the rules made under it, our grievance team
          handles complaints. Email {mail} with &ldquo;Grievance&rdquo; in the subject.
        </p>
        <p>
          We acknowledge complaints within 24 hours and resolve them within 15 days. Content that
          shows nudity or sexual acts, or impersonates someone, is removed within 24 hours of a
          complaint. If our decision does not satisfy you, you can appeal to the Grievance Appellate
          Committee at <a href="https://gac.gov.in">gac.gov.in</a> within 30 days.
        </p>
        <p>
          The <Link href="/contact#grievances">Contact page</Link> explains what to include in a
          complaint.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <DocPage
      eyebrow="Legal"
      title="Terms of use"
      intro={
        <p>
          The rules for using cricketmatch.today, in plain words: what the site is, what we check,
          what you can post, and how to complain.
        </p>
      }
      updated={POLICIES_UPDATED}
      sections={SECTIONS}
    />
  );
}
