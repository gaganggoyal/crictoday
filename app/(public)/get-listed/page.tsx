import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { PROFILE_KIND_HINT, PROFILE_KIND_LABEL, PROFILE_KINDS } from "@/lib/domain/profiles";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "List your cricket academy, club or committee for free",
  "A free profile for your academy, club, committee or ground: your offers, contact details and matches, found by cricket fans in your city.",
  "/get-listed",
);

const STEPS = [
  {
    title: "Sign in with your email",
    body: "No password. We email you a link that signs you in.",
  },
  {
    title: "Create your profile",
    body: "Your name, town, contact details and what you offer. A moderator checks it once before it goes public.",
  },
  {
    title: "Post your matches",
    body: "A friendly, a league game or a whole tournament schedule. Once your profile is checked, matches go live at once.",
  },
];

const GETS = [
  [
    "Your own page",
    "Contact details, a WhatsApp button, your ground on the map, and links to your website and social pages.",
  ],
  [
    "Your offers, with prices",
    "Coaching batches, camps, trials, nets, ground hire, tournament entry and membership, with timings.",
  ],
  [
    "Matches people can find",
    "Your matches appear on your city and state pages, in search, and on your own page.",
  ],
  [
    "Free, and you stay in charge",
    "We do not take bookings or payments. People contact you directly. Edit or cancel anything at any time.",
  ],
];

export default async function GetListedPage() {
  const session = await getSession();
  const start = session ? "/dashboard/profiles/new" : "/login?next=/dashboard/profiles/new";
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">
        For academies, clubs, committees and grounds
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
        Put your cricket on the map, for free
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Create a profile in a few minutes, list what you offer, and post your matches. Cricket fans
        in your city find you on cricketmatch.today.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={start}
          className="inline-flex min-h-12 items-center rounded-full bg-[#176B43] px-6 text-[15px] font-medium text-white"
        >
          Create your free profile
        </Link>
        {session ? (
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center rounded-full border border-line px-6 text-[15px] font-medium"
          >
            Your account
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="steps" className="mt-14">
        <h2 id="steps" className="font-display text-3xl font-extrabold">
          Three steps
        </h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-[1.25rem] border border-line bg-surface p-5">
              <p className="font-display text-4xl font-extrabold text-link">{index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="who" className="mt-14">
        <h2 id="who" className="font-display text-3xl font-extrabold">
          Who can list
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROFILE_KINDS.map((kind) => (
            <li key={kind} className="rounded-[1.25rem] border border-line bg-surface p-5">
              <h3 className="text-lg font-semibold">{PROFILE_KIND_LABEL[kind]}</h3>
              <p className="mt-1 text-sm text-muted">{PROFILE_KIND_HINT[kind]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gets" className="mt-14">
        <h2 id="gets" className="font-display text-3xl font-extrabold">
          What you get
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {GETS.map(([title, body]) => (
            <li key={title} className="rounded-[1.25rem] border border-line bg-surface p-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="questions" className="mt-14 max-w-3xl">
        <h2 id="questions" className="font-display text-3xl font-extrabold">
          Questions
        </h2>
        <dl className="mt-5 grid gap-5">
          <div>
            <dt className="font-semibold">Why is there a check?</dt>
            <dd className="mt-1 text-muted">
              So that every profile on the site is real and its contact belongs to it. You can add
              offers and matches while you wait. They go public when the check passes.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What does it cost?</dt>
            <dd className="mt-1 text-muted">Nothing.</dd>
          </div>
          <div>
            <dt className="font-semibold">Can I sell tickets here?</dt>
            <dd className="mt-1 text-muted">
              No. If your match is ticketed, add the link to where you sell tickets. A moderator
              checks it before it shows.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">I only know about one match. Do I need a profile?</dt>
            <dd className="mt-1 text-muted">
              No. <Link href="/submit/match">Report the match</Link> with a link to where it is
              announced, and a moderator reviews it.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
