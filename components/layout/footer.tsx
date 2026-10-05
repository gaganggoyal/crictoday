import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Footer({ demo, email }: { demo: boolean; email: string | null }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface max-md:pb-24">
      <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">
            Find cricket you can attend, then leave through a reviewed ticket link. We do not sell seats and we do not run a resale market.
          </p>
        </div>
        <FooterColumn
          title="Explore"
          links={[
            ["/matches", "Matches"],
            ["/countries", "Countries"],
            ["/leagues", "Top leagues"],
            ["/academies", "Academies"],
          ]}
        />
        <FooterColumn
          title="Organisers"
          links={[
            ["/submit/match", "List a match"],
            ["/submit/academy", "List an academy"],
            [email ? "/dashboard" : "/login", email ? "Account" : "Sign in"],
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            ["/legal/terms", "Terms"],
            ["/legal/privacy", "Privacy"],
            ["/legal/ticket-policy", "Ticket policy"],
            ["/about/demo-data", "Demo data"],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-2 px-5 py-4 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} cricketmatch.today</p>
          <p>
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
      <ul className="mt-3 grid gap-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-muted hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
