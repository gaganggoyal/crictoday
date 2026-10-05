# cricketmatch.today implementation plan

Attendance product for upcoming cricket. The public question is where the match is, when it starts in local time, and whether there is an official or authorised way in. Scores are out of scope.

## Product rules

- One attendance state per match: `OFFICIAL_LINK`, `AUTHORISED_PARTNER`, `REQUEST_ALERT`, `FREE_ENTRY`, `SOLD_OUT`, `PRIVATE_EVENT`, `CANCELLED`, `POSTPONED`.
- A price is shown only with a currency and a check newer than 7 days.
- Ticket links open `/go/[offerId]` first. The seller and domain are visible before the external site.
- A fixture is public only when its status is published, postponed, cancelled, or completed, and it has a source URL.
- Organiser ticket URLs stay pending until a moderator approves the offer. Approval is the only way a domain joins the allow list.
- Corrections record a decision. They do not rewrite fixture facts.
- Demo rows are labelled DEMO and load only when `NODE_ENV` is not production, or when `ALLOW_DEMO_DATA=true`. Production without Supabase env shows an empty catalog.
- No scraping, no peer-to-peer resale, no client secrets.

## Runtime

- Next.js App Router, TypeScript strict, Tailwind CSS 4, Zod, React Hook Form.
- Public pages are server-rendered. Filters are GET forms and live in the query string: `q`, `country`, `city`, `from`, `to`, `kind`, `format`, `tickets`, `sort`, `page`.
- Demo persistence is `.data/store.json`. Pure transitions live in `lib/domain/workflows.ts`.
- Supabase is the production database. The anon client reads `match_directory` and `academy_directory`. Those views are `security_invoker`, so row level security still applies.
- Sign-in for the demo is an HMAC httpOnly cookie. Supabase Auth is the production target and is not wired yet. While `dataMode()` is `supabase` or `unconfigured`, sign-in, submissions, alerts and moderation refuse to write the demo file.
- Email goes through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set, otherwise the message is printed to the server console.
- PostHog and Sentry initialise only when their env vars are present.
- Fixture import uses SportMonks when `SPORTMONKS_API_TOKEN` is set. Ticketmaster matches are stored as pending, unapproved offers. The cron route requires `Authorization: Bearer $CRON_SECRET`.

## Data modes

| Mode         | When                                 | Catalog                                | Writes                                                                             |
| ------------ | ------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------- |
| demo         | Local dev, or `ALLOW_DEMO_DATA=true` | Labelled seed plus the JSON store      | JSON store                                                                         |
| mysql        | `DATABASE_URL` is a `mysql://` URL   | `matches`, `academies` in MySQL        | MySQL transactions in `lib/data/mysql`, called after the server checks the session |
| supabase     | URL and publishable key are set      | `match_directory`, `academy_directory` | Closed until service-role review functions are called by the server                |
| unconfigured | Production without Supabase          | Empty                                  | Closed                                                                             |

## Database

`supabase/migrations/20261004120000_init.sql` creates the catalog, offers, requests, academies, submissions, audit, clicks, import runs, and domain rules. Anonymous clients can read a public match only when it has a source. They cannot insert matches or read the audit log. Authenticated fans can update `display_name`, `phone`, and `country_code` on their own profile. `create_submission` is security definer and always stores `pending`. `set_user_role` is the only supported role change.

PGlite coverage lives in `tests/rls/policies.test.ts`. It applies `supabase/tests/bootstrap.sql` first. That bootstrap is for tests only. Hosted Supabase already has `auth.uid()` and the `anon`, `authenticated`, and `service_role` roles.

## Launch content

India, England, and Australia are the launch countries. The featured demo match is India vs Australia, 1st Test, Narendra Modi Stadium, 16 October 2026, 09:30 Asia/Kolkata. West Indies uses ISO-like code `WI` because it is a cricket region, not a single country. That is stated on the country page.

## Verification

`pnpm run ci` runs lint, typecheck, unit tests, and the production build. `pnpm test:e2e` runs Playwright against `pnpm dev`. There is no interactive browser tool in this environment, so end-to-end coverage is Playwright and HTTP checks.
