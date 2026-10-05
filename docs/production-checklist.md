# Production checklist

Do not point cricketmatch.today at the public internet until these are true.

- [ ] `pnpm run ci` passes on the commit being deployed.
- [ ] `ALLOW_DEMO_DATA` is unset. The homepage does not show the demo banner or a DEMO fixture.
- [ ] Supabase URL, publishable key, and secret key are set, and both migrations have been applied.
- [ ] `ENCRYPTION_KEY` and `CRON_SECRET` are unique production secrets.
- [ ] `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `SPORTMONKS_API_TOKEN`, and `TICKETMASTER_API_KEY` are server-only.
- [ ] A real moderator account exists in `profiles` and can be audited.
- [ ] The secret key is present, so server actions can call the service-role functions. Do not point production at the JSON store.
- [ ] Every public match has a source URL and a `last_verified_at` a person can explain.
- [ ] Ticket offers are `pending` until a moderator sets `approved_by`. Ticketmaster rows are never auto-approved.
- [ ] The allow list changes only from that approval. Shorteners and the deny list stay blocked.
- [ ] Prices without a currency, or older than 7 days, are absent.
- [ ] `/go/[offerId]` shows the seller domain before the external link.
- [ ] Resend sends from a domain you control. Console email is not the production path.
- [ ] Cron uses the bearer secret. A second overlapping run does not start within 10 minutes.
- [ ] Sentry and PostHog are optional and stay off when their keys are empty.
- [ ] HSTS is served over HTTPS. CSP, `nosniff`, `DENY` framing, and a locked-down permissions policy are present.
- [ ] `rate_limits` is the shared limiter whenever Supabase is configured. Do not run a second instance against the demo JSON store.
- [ ] No live fixture, price, or ticket URL was invented to fill the homepage.
