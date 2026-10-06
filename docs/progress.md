# Progress

Updated 6 October 2026, after adding club profiles and the India menu.

## Done

- Next.js App Router app with the public information architecture: home, matches, match detail, countries, Indian states, cities, leagues, seasons, teams, venues, clubs and academies, get-listed, submit, legal, demo-data, login, requests, go interstitial, dashboard, and admin.
- Attendance states, price window, source requirement, and the outbound interstitial.
- Demo seed labelled DEMO, hidden in production unless `ALLOW_DEMO_DATA=true`.
- JSON workflow store for local demo: submissions, alerts, offer approval, expiry, audit.
- SportMonks and Ticketmaster normalizers. Import planning is idempotent. Demo import now applies inserts and non-organiser updates. Ticketmaster offers stay pending and unapproved.
- Supabase migration with RLS, column grants, `create_submission`, `set_user_role`, and security-invoker directory views.
- PGlite tests for the anonymous catalog, denied inserts, fan role protection, forced pending submissions, and moderator audit reads.
- Vitest coverage for time zones, URLs, filters, duplicates, providers, workflows, and the ticket badge.
- Playwright spec for the home heading, filter URL, seller domain, alert validation, submission validation, a phone-width admin sign-in, and a 375px overflow check.
- Security headers, optional Sentry/PostHog, Resend-or-console email, cron bearer secret.
- Missing catalog routes call `notFound()` from metadata as well as the page. The root `loading.tsx` was removed because it forced those responses to stream as HTTP 200.
- Supabase mode writes submissions, reviews, role changes, ticket alerts, offer approval, and outbound clicks through service-role functions after the server checks the session.
- SportMonks upserts run inside `import_runs`. Ticketmaster offers stay pending.
- Supabase Auth magic links replace the demo cookie when Supabase is configured. Demo sign-in stays on the local store, and `/login/verify` sets that cookie on a same-host redirect.
- Rate limits use `rate_limits` when Supabase is configured, and the in-memory limiter otherwise.
- Test pass on 5 October 2026. Fixed: an open redirect through the sign-in `next` path, forms that cleared input after a server error (including a review form that fell back to Approve), alert links that changed state on a GET, an invalid `.ics` export, the alert email text and failed-send handling, an unreadable dark-mode hero select, the Next.js 16 scroll warning, and `pnpm ci` in the docs. 18 Playwright and 34 Vitest tests pass.
- Production runs on the VPS with MySQL since 5 October 2026, at https://cricketmatch.today. `admin@cricketmatch.today` is the admin. See [deployment.md](deployment.md).
- Real fixtures since 6 October 2026. [data/fixtures/2026-27.json](../data/fixtures/2026-27.json) lists 209 matches in 23 series, each linked to the board's or organiser's own page: internationals in India, Australia, South Africa, New Zealand, Pakistan, Bangladesh and the UAE, and the WBBL|12, BBL|16 and SA20 2027 regular seasons. `pnpm db load-fixtures` loaded them, and the DEMO matches and academies were removed. The database was backed up first, in `/root/backups/`.
- Email is on since 5 October 2026. Resend sends from `hello@cricketmatch.today` with a send-only key, and Spaceship forwards `admin@` and `hello@`. A sign-in email to admin@ and a test to hello@ were both delivered. On the server, `pnpm db sign-in-link <email>` prints a one-time sign-in link without email.
- Emails are HTML in the site's style, with a plain-text part: the logo, the ball-in-grass banner, and for alerts a match panel with kick-off, venue and seller. `pnpm email:preview` writes or sends samples.
- Official ticket links since 6 October 2026, for 145 of the 209 matches. They come from Cricket Australia's fixture data, Cricket South Africa's Ticketpro shop, New Zealand Cricket's ticket site, the state associations' District and ticketgenie pages, and the PCB's ticket site; sold-out matches say so. The fixture file lists them, and a link can wait for its sale to open. The hourly sync loads `data/fixtures`, so the file goes live within the hour of a deploy, and it emails the ticket alerts that new links answer.
- Browse by place since 6 October 2026. A shop-style menu opens Countries, then India's 28 states and 8 union territories, then their towns, from `lib/data/india.ts`; phones get a drill-down drawer. Every state has a page, and every listed Indian town has one even before anything is listed there. Matches and profiles store their state.
- Club and academy profiles since 6 October 2026. Academies, clubs, committees and leagues, and grounds and turfs sign in with their email and create a profile: about, place, contact with WhatsApp and social links, age groups, facilities, and offers such as coaching, camps, trials, nets, ground hire, tournament entry and membership. They post matches from a short form with "post and add another" for tournament schedules, and can edit, postpone or cancel them. A moderator checks each profile once at `/admin/profiles`; until then it and its matches stay hidden. Approved profiles publish matches at once with the profile as their source. Moderators are emailed about new profiles, and owners when a profile goes live or is sent back.

## Not done

- Some scheduled matches wait for confirmed start times, and knockouts wait for their teams. India v Sri Lanka in Delhi on 13 December is hidden until the BCCI names a new ground. [data/fixtures/README.md](../data/fixtures/README.md) lists them.
- 64 matches have no ticket link yet, mostly because their sales have not opened. The README lists them.
- Sold-out states and new ticket links need someone to recheck the boards' pages; nothing fetches them automatically.
- No clubs or academies are listed yet; the first will come through the new profiles.
- Profiles are created and edited only with the MySQL database. The demo store and the Supabase path show their academies read-only.
- Profiles have no logo or photos, and a schedule is posted one match at a time, not from a spreadsheet.
- No live provider tokens are configured.
- A pending alert whose confirmation email failed cannot get a new one. A retry says the alert exists. Re-sending needs the request's token hashes to be rotated.
- On a phone, `/matches` shows ten filter fields before the first result.
- The server runs Node 20, which supabase-js now warns about. Node 22 is the safer host version.
- The Supabase path is kept but untested against a hosted project; RLS and its functions are verified with PGlite.

## Next

1. Recheck `data/fixtures` at least weekly: listings older than seven days are marked unverified. Add the waiting matches, ticket links as sales open, and sold-out states, then deploy.
2. Invite the first academies, clubs and committees to `/get-listed`, and check new profiles at `/admin/profiles`.
3. Add the `cricketmatch` database to the server's scheduled MySQL backups.
4. Licence SportMonks before setting `SPORTMONKS_API_TOKEN`. Ticketmaster offers stay pending.
