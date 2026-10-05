# Progress

Updated 5 October 2026, after the VPS deployment.

## Done

- Next.js App Router app with the public information architecture: home, matches, match detail, countries, cities, leagues, seasons, teams, venues, academies, submit, legal, demo-data, login, requests, go interstitial, dashboard, and admin.
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

## Not done

- Some scheduled matches wait for confirmed start times, and knockouts wait for their teams. [data/fixtures/README.md](../data/fixtures/README.md) lists them.
- No ticket links are listed yet. Cricket Australia's fixture data names a ticket seller for most Australian matches.
- No academies are listed since the DEMO academies were removed.
- No live provider tokens are configured.
- A pending alert whose confirmation email failed cannot get a new one. A retry says the alert exists. Re-sending needs the request's token hashes to be rotated.
- On a phone, `/matches` shows ten filter fields before the first result.
- The server runs Node 20, which supabase-js now warns about. Node 22 is the safer host version.
- The Supabase path is kept but untested against a hosted project; RLS and its functions are verified with PGlite.

## Next

1. Keep `data/fixtures` current: add the waiting matches as boards publish start times, and new series as they are announced, then run `pnpm db load-fixtures`.
2. Add official ticket links, starting with the sellers Cricket Australia lists for its matches.
3. Add the `cricketmatch` database to the server's scheduled MySQL backups.
4. Licence SportMonks before setting `SPORTMONKS_API_TOKEN`. Ticketmaster offers stay pending.
