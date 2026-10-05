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
- Production runs on the VPS with MySQL since 5 October 2026, at https://cricketmatch.today. The labelled DEMO catalogue is loaded and `admin@cricketmatch.today` is the admin. See [deployment.md](deployment.md).

## Not done

- Email is not set up. Sign-in links and alert mail go to `journalctl -u cricketmatch` until Resend is configured. cricketmatch.today has no MX records yet, so `admin@cricketmatch.today` cannot receive mail. The ImprovMX account is on the free plan, which holds one domain, and kidspc.online uses it.
- The public catalogue is the DEMO seed. No real fixture is listed yet.
- No live provider tokens are configured.
- A pending alert whose confirmation email failed cannot get a new one. A retry says the alert exists. Re-sending needs the request's token hashes to be rotated.
- On a phone, `/matches` shows ten filter fields before the first result.
- The server runs Node 20, which supabase-js now warns about. Node 22 is the safer host version.
- The Supabase path is kept but untested against a hosted project; RLS and its functions are verified with PGlite.

## Next

1. Review and merge PR #1, then PR #2, and deploy `main` with `deploy/vps/deploy.sh`.
2. Email, as on kidspc.online: send with Resend and receive with ImprovMX, which needs the Light plan or a second account first. The steps are in [deployment.md](deployment.md#email).
3. Approve real fixtures through `/submit/match` and `/admin`, then run `pnpm db remove-demo`.
4. Add the `cricketmatch` database to the server's MySQL backups.
5. Licence SportMonks before setting `SPORTMONKS_API_TOKEN`. Ticketmaster offers stay pending.
