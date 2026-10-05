# Deployment

cricketmatch.today runs on the shared VPS (`161.97.97.34`) with MySQL. The Supabase and Vercel setup in section 2 still works, but production does not use it.

## 1. VPS with MySQL (production)

| Piece    | Where                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Code     | `/var/www/cricketmatch`, a clone of `main`, owned by the `cricketmatch` user                                                                  |
| Process  | `cricketmatch.service` runs `next start` on port 3300                                                                                         |
| HTTPS    | The Caddy container from `/root/cricketverse_deploy` proxies to `172.18.0.1:3300`                                                             |
| Firewall | ufw admits 3300 only from the Docker bridge range `172.16.0.0/12`                                                                             |
| Data     | The `cricketmatch` database on the server's MySQL 8, with its own `cricketmatch` user. It shares the server with indiaoffers, not its tables. |
| Settings | `/var/www/cricketmatch/.env`, mode 600                                                                                                        |
| Sync     | `cricketmatch-sync.timer` calls `/api/cron/sync` every hour                                                                                   |

The unit files, the Caddy block and the scripts are in `deploy/vps/`.

### Deploy

```bash
ssh root@161.97.97.34 /var/www/cricketmatch/deploy/vps/deploy.sh
```

It checks out `origin/main` (or the branch or commit you pass as the first argument), installs, builds, applies new `db/mysql/*.sql` files, restarts the service, and waits for it to answer. `NEXT_PUBLIC_SITE_URL` is read at build time, so change it with a deploy, not a restart.

### Database commands

Run these in `/var/www/cricketmatch` as the app user, for example `runuser -u cricketmatch -- env HOME=/var/lib/cricketmatch corepack pnpm db migrate`.

- `pnpm db migrate` applies `db/mysql/*.sql` files that have not run.
- `pnpm db seed-demo` loads the labelled DEMO catalogue. `pnpm db remove-demo` deletes it, with its offers, alerts and clicks. Run it when real fixtures are listed.
- `pnpm db set-role <email> <role>` creates the account if needed and sets its role. `admin@cricketmatch.today` is the first admin.
- `pnpm db sign-in-link <email>` prints a one-time sign-in link, valid for 30 minutes. Use it when email cannot reach that address.

Back up the database with the server's other MySQL backups: `mysqldump --single-transaction cricketmatch`.

### Email

Until email is configured, mail is written to the service log, `journalctl -u cricketmatch`. To sign in without email at any time, print a link on the server:

```bash
cd /var/www/cricketmatch && runuser -u cricketmatch -- env HOME=/var/lib/cricketmatch corepack pnpm db sign-in-link admin@cricketmatch.today
```

cricketmatch.today handles mail the way kidspc.online does: Resend sends it and ImprovMX receives it. The domain's DNS is at Spaceship.

1. **Sending.** Add cricketmatch.today to Resend in the region kidspc.online uses (`ap-northeast-1`). Add the records Resend lists: a DKIM TXT record at `resend._domainkey`, and an MX record and an SPF TXT record at `send`. Create a sending-only API key for the domain.
2. **Receiving.** Add the domain to ImprovMX, point its MX records at `mx1.improvmx.com` (priority 10) and `mx2.improvmx.com` (priority 20), and forward `admin@` and `hello@` to a real inbox. ImprovMX's free plan holds one domain and kidspc.online uses it, so this needs the Light plan or above, or a second account.
3. Add a DMARC record: TXT at `_dmarc`, `v=DMARC1; p=none; rua=mailto:hello@cricketmatch.today`.
4. In `.env`, set `RESEND_API_KEY` and `EMAIL_FROM`, for example `cricketmatch.today <hello@cricketmatch.today>`, then run `systemctl restart cricketmatch`.

Any SMTP server can send instead. Set `SMTP_HOST`, `SMTP_PORT` (465 is TLS from the start, 587 is STARTTLS), `SMTP_USER` and `SMTP_PASS`. SMTP is used ahead of Resend when both are set. ImprovMX's paid plans include SMTP at `smtp.improvmx.com`.

### First install

`deploy/vps/` documents the steps that were run once: create the `cricketmatch` system user (home `/var/lib/cricketmatch`, so pnpm caches stay out of the checkout) and MySQL user, clone into `/var/www/cricketmatch`, write `.env`, `pnpm install`, `pnpm build`, `pnpm db migrate`, install and enable `cricketmatch.service` and `cricketmatch-sync.timer`, open 3300 to the Docker bridge in ufw, append `deploy/vps/Caddyfile` to the cricketverse Caddyfile, and `caddy reload` in the container.

## 2. Alternative: Supabase and Vercel

### Supabase

1. Create a project.
2. In the SQL editor, run `supabase/migrations/20261004120000_init.sql`, then `supabase/migrations/20261004180000_service_workflows.sql`. Do not run `supabase/tests/bootstrap.sql` on the hosted project.
3. Confirm RLS is enabled. The migrations do this for every exposed table, including `rate_limits`.
4. Copy the project URL, the publishable key, and the secret key. The secret key stays on the server. It bypasses RLS, so the app calls the service-role functions only after it has checked the session.
5. In Authentication, enable the email provider. Set the site URL to `https://cricketmatch.today`. Add `https://cricketmatch.today/auth/callback` and `http://localhost:3000/auth/callback` to the redirect allow list.
6. Create the first admin in the SQL editor: `update public.profiles set role = 'admin' where email = 'you@example.com';`. After that, the admin form can call `set_user_role_for_account`.

Signed-in people use Supabase magic links, so `auth.uid()` is that person. Anonymous submissions, alerts, reviews, offer approval, and imports go through the secret key. The functions force `pending` on new submissions and refuse to publish a ticket offer that has not been approved.

### Vercel

Set these environment variables on the production project. Leave `DATABASE_URL` unset, or the app uses MySQL instead of Supabase.

- `NEXT_PUBLIC_SITE_URL` = `https://cricketmatch.today`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ENCRYPTION_KEY` (32+ random bytes, required in production)
- `CRON_SECRET`
- `EMAIL_FROM`, plus `RESEND_API_KEY` or the `SMTP_*` settings when outbound email should leave the console
- `SPORTMONKS_API_TOKEN` and `TICKETMASTER_API_KEY` only on the server, and only after a licence is in place
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to enable analytics
- `SENTRY_DSN` to enable Sentry

Leave `ALLOW_DEMO_DATA` unset in production.

Build command: `pnpm build`. Install command: `pnpm install`. Node 20 or newer.

Add a Vercel cron, or an external scheduler, for `GET /api/cron/sync` with header `Authorization: Bearer <CRON_SECRET>`. SportMonks rows are upserted inside `import_runs`. Ticketmaster offers are inserted as `pending` and are not public. Organiser and academy rows are not overwritten. A second run does not start while one is still inside the last 10 minutes.

## 3. HTTPS

The production build sends HSTS (`max-age=63072000; includeSubDomains; preload`), so every subdomain of cricketmatch.today must serve HTTPS. Submit the domain to the preload list only after HTTPS has been stable.

## 4. Local checks

```bash
pnpm run ci
pnpm dev
```

To run against MySQL locally, set `DATABASE_URL` to a `mysql://` URL, then run `pnpm db migrate`, `pnpm db seed-demo`, and `pnpm db set-role admin@cricketmatch.today admin`. Outside production the sign-in page shows the link as well as logging it. `MYSQL_TEST_URL=mysql://user:password@127.0.0.1:3306 pnpm test` adds the MySQL integration tests; that user needs CREATE and DROP on `cm_t_*` databases.

`pnpm start` after a build is `NODE_ENV=production`. With no database and without `ALLOW_DEMO_DATA=true`, the catalog is empty on purpose.
