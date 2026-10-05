# Deployment

cricketmatch.today is a Next.js app. The demo store is local. Production inventory comes from Supabase and stays empty until that database has reviewed rows.

## 1. Supabase

1. Create a project.
2. In the SQL editor, run `supabase/migrations/20261004120000_init.sql`, then `supabase/migrations/20261004180000_service_workflows.sql`. Do not run `supabase/tests/bootstrap.sql` on the hosted project.
3. Confirm RLS is enabled. The migrations do this for every exposed table, including `rate_limits`.
4. Copy the project URL, the publishable key, and the secret key. The secret key stays on the server. It bypasses RLS, so the app calls the service-role functions only after it has checked the session.
5. In Authentication, enable the email provider. Set the site URL to `https://cricketmatch.today`. Add `https://cricketmatch.today/auth/callback` and `http://localhost:3000/auth/callback` to the redirect allow list.
6. Create the first admin in the SQL editor: `update public.profiles set role = 'admin' where email = 'you@example.com';`. After that, the admin form can call `set_user_role_for_account`.

Signed-in people use Supabase magic links, so `auth.uid()` is that person. Anonymous submissions, alerts, reviews, offer approval, and imports go through the secret key. The functions force `pending` on new submissions and refuse to publish a ticket offer that has not been approved.

## 2. Vercel

Set these environment variables on the production project:

- `NEXT_PUBLIC_SITE_URL` = `https://cricketmatch.today`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `ENCRYPTION_KEY` (32+ random bytes, required in production)
- `CRON_SECRET`
- `EMAIL_FROM`
- `RESEND_API_KEY` when outbound email should leave the console
- `SPORTMONKS_API_TOKEN` and `TICKETMASTER_API_KEY` only on the server, and only after a licence is in place
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to enable analytics
- `SENTRY_DSN` to enable Sentry

Leave `ALLOW_DEMO_DATA` unset in production. Do not set it to `true` on the public site.

Build command: `pnpm build`. Install command: `pnpm install`. Node 20 or newer.

Add a Vercel cron, or an external scheduler, for `GET /api/cron/sync` with header `Authorization: Bearer <CRON_SECRET>`. With Supabase configured, SportMonks rows are upserted inside `import_runs`. Ticketmaster offers are inserted as `pending` and are not public. Organiser and academy rows are not overwritten. A second run does not start while one is still inside the last 10 minutes.

## 3. DNS and HTTPS

Point the domain at Vercel. The production build sends HSTS (`max-age=63072000; includeSubDomains; preload`). Submit the domain to the preload list only after HTTPS has been stable.

## 4. Local production-like check

```bash
pnpm run ci
ALLOW_DEMO_DATA=true pnpm dev
```

`pnpm start` after a build is `NODE_ENV=production`. Without Supabase env and without `ALLOW_DEMO_DATA=true`, the catalog is empty on purpose.
