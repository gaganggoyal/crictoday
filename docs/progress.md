# Progress

Updated 5 October 2026.

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

## Not done

- Docker and the Supabase CLI were not started. RLS and the service-role functions are verified with PGlite.
- No live provider tokens are configured, so local `pnpm dev` still uses the labelled demo inventory.
- The first admin is created in the SQL editor. The admin form can change roles only after that person exists.
- Supabase Auth, Resend, and the redirect allow list are configuration, not code. They stay idle until the env vars and dashboard settings are filled in.
- A pending alert whose confirmation email failed cannot get a new one. A retry says the alert exists. Re-sending needs `create_ticket_request` to rotate the token hashes.
- On a phone, `/matches` shows ten filter fields before the first result.
- supabase-js warns that Node 20 is deprecated. Use Node 22 for builds and the host.

## Next

1. Apply both SQL migrations on the hosted project and create the first admin.
2. Set the Supabase Auth site URL and allow `https://cricketmatch.today/auth/callback`.
3. Add `SUPABASE_SECRET_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`, and `RESEND_API_KEY` on the host.
4. Licence SportMonks before turning on the cron. Leave Ticketmaster offers pending.
5. Confirm a second app instance shares `rate_limits` before taking public writes.
