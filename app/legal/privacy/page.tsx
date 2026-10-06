import Link from "next/link";
import { DocPage, Facts, type DocSection } from "@/components/layout/doc-page";
import { CONTACT_EMAIL, GRIEVANCE_OFFICER, POLICIES_UPDATED } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Privacy policy",
  "What personal data cricketmatch.today collects, why, who sees it, how long we keep it, and how to see, correct or delete yours.",
  "/legal/privacy",
);

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const SECTIONS: DocSection[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <ul>
        <li>
          We collect as little as we can: your email address when you sign in, ask for a ticket
          alert or write to us, and what clubs and academies choose to publish on their profiles.
        </li>
        <li>
          We do not sell or rent personal data. We show no ads and use no advertising trackers.
        </li>
        <li>
          If you only browse, we set no cookies. If you sign in, we set one cookie that keeps you
          signed in.
        </li>
        <li>Email addresses given for ticket alerts are stored encrypted.</li>
        <li>
          You can ask us to show you, correct or delete your data at any time. Write to {mail}.
        </li>
      </ul>
    ),
  },
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          cricketmatch.today is a website for finding cricket to watch and play. It is run from
          India by its founders, Gagan and Vansh. In this policy, &ldquo;we&rdquo;, &ldquo;us&rdquo;
          and &ldquo;our&rdquo; mean cricketmatch.today and its founders.
        </p>
        <p>
          We decide why and how your personal data is used, which makes us its &ldquo;data
          fiduciary&rdquo; under India&apos;s Digital Personal Data Protection Act, 2023. This
          policy explains what we do with personal data, as that Act and the Information Technology
          Act, 2000 ask.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect and why",
    body: (
      <>
        <h3 id="browsing">When you browse</h3>
        <p>You do not need an account to use cricketmatch.today, and we do not ask who you are.</p>
        <ul>
          <li>
            <strong>Ticket clicks.</strong> When you continue from our &ldquo;Check the
            seller&rdquo; page to a ticket seller, we record the match, the ticket link, the page on
            our site you came from, and the time. This tells us which links people use. It does not
            say who you are.
          </li>
          <li>
            <strong>Stopping abuse.</strong> When a form is sent, we keep a one-way code (a hash)
            made from your IP address or account and the action, so we can limit repeated attempts.
            It is deleted within about a day.
          </li>
          <li>
            <strong>Errors.</strong> Our web server does not keep a log of visits. When something
            goes wrong, the error is written to the server&apos;s log, which keeps only recent
            entries.
          </li>
        </ul>

        <h3 id="signing-in">When you sign in</h3>
        <ul>
          <li>
            Your email address. We email you a sign-in link that works once, for 30 minutes. We
            store only a fingerprint (a hash) of the link, not the link itself.
          </li>
          <li>
            Your first sign-in creates an account: your email address, a display name taken from the
            part before the @, your role (such as club owner or moderator) and the date.
          </li>
          <li>
            Why: so you can manage your profiles, matches and alerts, and so we can email you about
            them.
          </li>
        </ul>

        <h3 id="ticket-alerts">When you ask for a ticket alert</h3>
        <ul>
          <li>
            Your email address, encrypted; the match; how many tickets you want; your country; any
            seating note you add; when you agreed to be emailed; and when you confirmed. To stop
            duplicate alerts we also keep a keyed fingerprint (a hash) of your address.
          </li>
          <li>
            Why: we email you once to confirm the alert, then once when an official ticket link for
            that match appears. Nothing else.
          </li>
          <li>
            An alert closes after that email, when you use the unsubscribe link in any of its
            emails, when the match starts, or if the match is cancelled.
          </li>
        </ul>

        <h3 id="profiles">When you list a club, academy, committee or ground</h3>
        <ul>
          <li>
            Your sign-in email address, which we use to write to you about the profile. It is not
            shown on the profile.
          </li>
          <li>
            Everything you add to the profile: its name and description, address, town and state,
            phone and WhatsApp numbers, contact email, website and social media links, age groups,
            facilities, offers with fees and timings, matches, logo, cover photo, photos and
            captions.
          </li>
          <li>
            <strong>Profiles are public.</strong> Once a moderator approves a profile, anyone can
            see everything on it, including search engines, and it appears in link previews when the
            page is shared on WhatsApp and other apps. Only add contact details that are meant for
            the public.
          </li>
          <li>We remove camera details and GPS location from every picture you upload.</li>
          <li>
            Why: to publish your profile and matches, and to check once that the profile is real and
            its contact details belong to it.
          </li>
        </ul>

        <h3 id="reports">When you report a match or a mistake</h3>
        <ul>
          <li>
            What you send, your email address if you give it, and any evidence. A moderator&apos;s
            notes are kept with it.
          </li>
          <li>Why: to check and publish the match, or fix the listing, and to reply to you.</li>
        </ul>

        <h3 id="messages">When you write to us</h3>
        <p>
          Emails to {mail} stay in our mailbox, so we can reply and keep track of what was asked.
        </p>

        <h3 id="changes-record">A record of changes</h3>
        <p>
          When someone creates, edits, approves or removes a profile, match, ticket link or picture,
          we record which account did it, its email address, what changed and when. This lets us fix
          mistakes and look into complaints.
        </p>

        <h3 id="never">What we never ask for</h3>
        <p>
          We never ask for payment details, identity documents, your date of birth or your location.
        </p>
      </>
    ),
  },
  {
    id: "emails",
    title: "Emails we send",
    body: (
      <>
        <p>We only send emails about something you asked for or take part in:</p>
        <ul>
          <li>sign-in links;</li>
          <li>ticket alert confirmations, and the alert itself;</li>
          <li>
            notices about your profile: when it goes live, when it needs changes, or if it is taken
            down;
          </li>
          <li>notices to moderators about new profiles.</li>
        </ul>
        <p>
          We do not send newsletters or marketing emails, and we never give your address to anyone
          else to send theirs.
        </p>
        <p>
          We may write once to an academy, club or ground at the email address it publishes on its
          own website or social pages, to invite it to list on cricketmatch.today. If you would
          rather we did not, reply &ldquo;no thanks&rdquo; and we will not write again.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <Facts
          items={[
            [
              "cm_session",
              "A cookie set only when you sign in. It keeps you signed in for up to 30 days, or until you sign out. It is signed so it cannot be altered, and scripts on the page cannot read it. Your account needs it.",
            ],
            [
              "theme",
              "Not a cookie: a setting in your browser's storage that remembers light or dark mode if you choose one. It never leaves your device.",
            ],
          ]}
        />
        <p>
          We use no analytics, advertising or social media cookies. Our pages load nothing from
          other companies&apos; servers: the fonts, pictures and code all come from
          cricketmatch.today. If we ever add analytics, we will update this policy before we switch
          it on.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who sees your data",
    body: (
      <>
        <ul>
          <li>
            <strong>Everyone</strong> can see approved profiles and matches.
          </li>
          <li>
            <strong>Our moderators</strong>, the founders and anyone they trust to help check
            listings, can see accounts, reports and profiles waiting for their check. They keep it
            confidential.
          </li>
          <li>
            <strong>Our service providers</strong> handle data only to provide their service to us:
            <ul>
              <li>Contabo, which hosts our server and database in Germany;</li>
              <li>Resend, which delivers the emails we send;</li>
              <li>
                Spaceship, our domain provider, which forwards email sent to our @cricketmatch.today
                addresses to our inbox;
              </li>
              <li>Google, where we keep private backup copies in Google Drive.</li>
            </ul>
          </li>
          <li>
            <strong>Ticket sellers, boards and other sites</strong> we link to get nothing from us.
            When you open their site, they may collect data under their own policies.
          </li>
          <li>
            <strong>The authorities</strong>, when Indian law, a court order or a lawful request
            from a government agency requires it, or when it is needed to protect someone from
            serious harm.
          </li>
          <li>
            <strong>A new owner</strong>, only if cricketmatch.today ever changes hands, and only
            under this policy. We would say so on this page first.
          </li>
        </ul>
        <p>We never sell, rent or trade personal data.</p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Where it is stored",
    body: (
      <p>
        Our server is in Germany. Emails pass through Resend&apos;s servers, and backup copies are
        kept in Google Drive, so your data may be stored or processed outside India. Indian law
        allows this, and we use only established providers.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <Facts
          items={[
            [
              "Sign-in links",
              "They work once, for 30 minutes. The record of each, with its email address, is deleted about a day after it expires.",
            ],
            ["Codes that stop repeated attempts", "About a day."],
            [
              "Pictures",
              "While they are on a profile. A picture its owner removes, or a moderator takes down, is deleted from the server at once.",
            ],
            [
              "Ticket alerts",
              "After an alert closes we keep it, with your address still encrypted, as a record of what you agreed to and what we sent. Ask us and we will delete it.",
            ],
            [
              "Backups",
              "The server keeps a copy from each of the last 14 nights, and we keep some older copies in private storage to recover from a disaster. Deleted data can remain in these copies until they are replaced. We use them only to restore the site.",
            ],
          ]}
        />
        <p>
          Everything else, including your account, profiles, reports, emails and the record of
          changes, we keep until you ask us to delete it or we no longer need it for the reasons
          above, whichever comes first. A few records may be kept longer when the law requires it.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <>
        <ul>
          <li>Every page is served over HTTPS, and browsers are told to always use it.</li>
          <li>
            Ticket alert email addresses are encrypted with AES-256-GCM, and the key is kept outside
            the database.
          </li>
          <li>
            Sign-in links work once and expire after 30 minutes, and we store only their
            fingerprints. There are no passwords to steal.
          </li>
          <li>The sign-in cookie is signed and cannot be read by scripts on the page.</li>
          <li>
            The database cannot be reached from the internet. Only the people who run the site can
            reach the server, the database and the moderation tools.
          </li>
          <li>Pictures lose their camera and GPS details when they are uploaded.</li>
          <li>Every change to a listing is recorded.</li>
        </ul>
        <p>
          No website can promise perfect security. If a breach affects your personal data, we will
          tell you and report it as Indian law requires.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>ask what personal data we hold about you and how we use it;</li>
          <li>
            ask us to correct, complete or update it. Profile owners can also edit their profiles at
            any time;
          </li>
          <li>ask us to delete it, or to delete your account;</li>
          <li>
            withdraw your consent: stop a ticket alert with the link in its email, or ask us to
            delete your account. This does not undo what we did before;
          </li>
          <li>
            nominate someone to use these rights for you if you die or are unable to act yourself;
          </li>
          <li>
            complain to us, and, if our answer does not satisfy you, to the Data Protection Board of
            India.
          </li>
        </ul>
        <p>
          To do any of these, email {mail} from the address the data is about, so we know the
          request is yours. We acknowledge requests within 24 hours and answer within 15 days.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <>
        <p>
          You must be 18 or over to create an account or ask for a ticket alert. If you are younger,
          ask a parent or guardian to do it for you.
        </p>
        <p>
          Academies and clubs often share photos of young players. Before you upload a photo of
          anyone under 18, get permission from their parent or guardian. If a photo of your child is
          on cricketmatch.today and you want it removed, email us the page link and we will take it
          down within 24 hours.
        </p>
      </>
    ),
  },
  {
    id: "other-sites",
    title: "Other websites",
    body: (
      <p>
        Match pages link to boards, organisers and ticket sellers, and profiles link to WhatsApp,
        Instagram, Facebook, YouTube, Google Maps and clubs&apos; own websites. Those sites have
        their own privacy policies, and we do not control what they collect.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        When we change this policy, we will publish the new version here and change the date at the
        top. If a change affects how we use data you have already given us, we will ask for your
        consent again where the law requires it.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact and complaints",
    body: (
      <>
        <p>
          For questions, requests or complaints about your data, email {mail}. Our Grievance Officer
          is {GRIEVANCE_OFFICER.name}, {GRIEVANCE_OFFICER.title}, at the same address. See the{" "}
          <Link href="/contact#grievance-officer">Grievance Officer</Link> details.
        </p>
        <p>
          We acknowledge complaints within 24 hours and resolve them within 15 days. If our answer
          does not satisfy you, you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <DocPage
      eyebrow="Legal"
      title="Privacy policy"
      intro={
        <p>
          What we collect when you use cricketmatch.today, why, who sees it, and how to see, correct
          or delete yours.
        </p>
      }
      updated={POLICIES_UPDATED}
      sections={SECTIONS}
    />
  );
}
