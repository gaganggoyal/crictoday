# Progress

Updated 7 October 2026, after putting official ticket sources at the front of the site.

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
- Profile pictures since 6 October 2026. Owners add a logo, a cover photo and up to 12 photos with captions, in order. The browser shrinks phone photos before sending; the server checks the file, turns it upright, strips camera and GPS data, and stores two WebP sizes. Cards, profile pages, match pages ("Posted by" with the logo), structured data and WhatsApp or social link previews use them. Moderators see new pictures on live profiles at `/admin/profiles` and can take any down.
- Spreadsheet schedules since 6 October 2026. Owners upload an .xlsx or CSV file, or paste rows from Excel or Google Sheets, and see every row checked before saving: dates day first or as Excel stores them, times like 9.30 am, a "Team vs Team" column, an Opponent column for a club's own fixtures, and the profile's ground and town where cells are empty. Adding the sheet again updates changed matches and skips the rest. Up to 200 matches at a time.
- A ticket alert whose confirmation email failed, or was lost, can be requested again: while it waits for confirmation, a new request replaces its links and sends the email again. Confirmed alerts still answer that they exist.
- On a phone, `/matches` shows its heading, the search box and folded filters, then the results.
- Nightly backups of the database and the uploaded pictures, kept for 14 nights in `/var/backups/cricketmatch`. See [deployment.md](deployment.md#backups).
- The app runs on Node 24 LTS in `/opt/node24`, beside the system's Node 20, which reached its end of life in April 2026 and stays for the server's other apps.
- About, contact and policy pages since 6 October 2026: `/about` with the founders, Gagan and Vansh; `/contact` with how to raise a grievance with the grievance team, as the IT Rules, 2021 ask; and a full privacy policy and terms of use at `/legal/privacy` and `/legal/terms`, written from what the site stores. The texts live in the pages; names and the contact address are in `lib/company.ts`. `/privacy`, `/terms`, `/about-us` and `/contact-us` redirect to them.
- Search and sharing since 6 October 2026, after an outside audit:
  - every match has its own title and description, such as "India vs West Indies 1st T20I tickets – Lucknow, 6 Oct 2026";
  - countries, states, towns, leagues, teams and grounds describe their own upcoming matches;
  - SportsEvent data marks only a real, approved sale as an offer;
  - the home page carries WebSite and Organization data, and deeper pages carry breadcrumbs;
  - link previews show a 1200×630 picture, drawn per match at `/og/match/<slug>` and site-wide at `/og/site`;
  - filtered `/matches` views and places with nothing listed are noindex and left out of the sitemap;
  - sitemap dates come from when a match, its ticket links or a profile last changed.
- Today, tomorrow and this weekend shortcuts on the home page and `/matches`, judged by the date at each ground. A Test counts for its five days.
- CI since 6 October 2026. GitHub Actions runs lint, typecheck, formatting, every Vitest suite (the MySQL ones against MySQL 8.0, as in production), the production build and the Playwright tests on every push and pull request. `pnpm typecheck` generates Next's route types first, so it also passes on a fresh clone.
- The README is written for people reviewing the code: what the site does, screenshots, the engineering choices, the stack and how to run it.
- On a phone, a match page shows its tickets straight after the details, before the correction form. The source line and the last-checked time read normally on match and profile pages.
- A match that has started says "Under way" instead of offering a ticket alert, and "Finished" two hours after it should be over (a Test runs for five days). Cards, filters, titles, descriptions, structured data and link previews follow, and a finished match drops its calendar button. Pages judge time through `lib/clock.ts`; in demo mode `DEMO_NOW` pins it, and the end-to-end tests run at 5 October 2026 so the dated demo keeps its states.

- Official ticket sources lead the site since 7 October 2026, from the first steps of an outside plan:
  - the home page opens with "Find cricket matches. Buy from the official source.", a "Find official tickets" button, three promises and a featured ticket route, and official ticket sources come straight after it;
  - match cards and the ticket panel show the seller's domain and when the link was checked, and ticket buttons say where they go, such as "View official ticket source";
  - "Request tickets" is now "Ticket alerts", and the menus link the official-ticket list, which has its own heading;
  - `/how-we-check-ticket-links` replaces the ticket policy, and the old address redirects to it;
  - the footer and the About page say the site is from the team behind indiaoffers.in. Nothing says whether ticket links earn a commission.

## Not done

- Some scheduled matches wait for confirmed start times, and knockouts wait for their teams. India v Sri Lanka in Delhi on 13 December is hidden until the BCCI names a new ground. [data/fixtures/README.md](../data/fixtures/README.md) lists them.
- 64 matches have no ticket link yet, mostly because their sales have not opened. The README lists them.
- Sold-out states and new ticket links need someone to recheck the boards' pages; nothing fetches them automatically.
- No clubs or academies are listed yet; the first will come through the new profiles.
- Profiles are created and edited only with the MySQL database. The demo store and the Supabase path show their academies read-only.
- No live provider tokens are configured.
- The Supabase path is kept but untested against a hosted project; RLS and its functions are verified with PGlite.
- Off-server backups are by hand: `deploy/vps/fetch-backup.sh --now` makes a folder to upload to Google Drive. The first copy was made on 6 October 2026. Nothing does it automatically.

## Next

1. In Google Search Console, add `cricketmatch.today` as a domain property (a TXT record at Spaceship), submit `https://cricketmatch.today/sitemap.xml`, and inspect the home page and a few match pages. The HTML tag method also works: put its token in `GOOGLE_SITE_VERIFICATION` in `.env` and restart.
2. Keep the promises the policies make: acknowledge complaints within 24 hours and resolve them within 15 days, take down photos of children within 24 hours of a request, and email profile owners before a change to the terms that affects them.
3. Recheck `data/fixtures` at least weekly: listings older than seven days are marked unverified. Add the waiting matches, ticket links as sales open, and sold-out states, then deploy.
4. Invite the first academies, clubs, committees and grounds with [outreach/invite-emails.md](outreach/invite-emails.md), and approve new profiles at `/admin/profiles` the same day.
5. Weekly, run `deploy/vps/fetch-backup.sh --now` and upload the folder to the private Google Drive folder.
6. Licence SportMonks before setting `SPORTMONKS_API_TOKEN`. Ticketmaster offers stay pending.
7. The rest of the ticket-source plan: states for a sale that is announced or a ballot that is open, an evidence panel and a review queue for each link, and link-health checks that flag a changed domain.
