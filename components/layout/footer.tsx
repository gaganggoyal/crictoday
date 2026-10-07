import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SISTER_SITE } from "@/lib/company";

export function Footer({ demo, email }: { demo: boolean; email: string | null }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface max-md:pb-24">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-4 text-sm font-semibold">Find the match. Feel the ground.</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Find cricket matches and buy from the official source. A person reviews every ticket
            link, you see the seller&apos;s domain before you leave, and we never list resale.
          </p>
          <p className="mt-3 text-sm text-muted">
            From the team behind{" "}
            <a
              href={SISTER_SITE.url}
              className="font-medium text-link underline underline-offset-4"
            >
              {SISTER_SITE.name}
            </a>
          </p>
        </div>
        <FooterColumn
          title="Explore"
          links={[
            ["/matches", "Matches"],
            ["/countries", "Countries"],
            ["/leagues", "Top leagues"],
            ["/academies", "Clubs and academies"],
          ]}
        />
        <FooterColumn
          title="Clubs and organisers"
          links={[
            ["/get-listed", "List your club or academy"],
            [email ? "/dashboard" : "/login", email ? "Your account" : "Sign in"],
            ["/submit/match", "Report a match"],
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            ["/about", "About us"],
            ["/contact", "Contact us"],
            ["/contact#grievances", "Grievance team"],
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            ["/legal/terms", "Terms of use"],
            ["/legal/privacy", "Privacy policy"],
            ["/how-we-check-ticket-links", "How we check ticket links"],
            ...(demo ? [["/about/demo-data", "Demo data"]] : []),
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-2 px-5 py-4 text-xs text-muted sm:flex-row sm:justify-between sm:gap-8">
          <p className="shrink-0">
            © {new Date().getFullYear()} cricketmatch.today · Made in India
          </p>
          <p className="sm:text-right">
            Independent, and not affiliated with the BCCI, the ICC or any board, league or team.{" "}
            {demo ? "Demo inventory is illustrative and labelled DEMO. " : null}
            Stadium photograph via Unsplash. Cabinet Grotesk and Satoshi via Fontshare.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-2 grid gap-1 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex min-h-8 items-center text-muted hover:text-foreground"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
