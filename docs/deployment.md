# Deployment

cricketmatch.today runs on the shared VPS (`161.97.97.34`) with MySQL. The Supabase and Vercel setup in section 2 still works, but production does not use it.

## 1. VPS with MySQL (production)

| Piece    | Where                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code     | `/var/www/cricketmatch`, a clone of `main`, owned by the `cricketmatch` user                                                                               |
| Process  | `cricketmatch.service` runs `next start` on port 3300, on Node 24 LTS in `/opt/node24`. The system's `/usr/bin/node` is left for the other apps.           |
| HTTPS    | The Caddy container from `/root/cricketverse_deploy` proxies to `172.18.0.1:3300`                                                                          |
| Firewall | ufw admits 3300 only from the Docker bridge range `172.16.0.0/12`                                                                                          |
| Data     | The `cricketmatch` database on the server's MySQL 8, with its own `cricketmatch` user. It shares the server with indiaoffers, not its tables.              |
| Settings | `/var/www/cricketmatch/.env`, mode 600                                                                                                                     |
| Sync     | `cricketmatch-sync.timer` calls `/api/cron/sync` every hour. It loads `data/fixtures`, emails the ticket alerts new links answer, and expires past offers. |
| Pictures | Profile logos and photos, as WebP files in `UPLOAD_DIR` (`/var/lib/cricketmatch/uploads`), served by the app at `/media/profiles/`                         |
| Backups  | `cricketmatch-backup.timer` dumps the database and copies the pictures to `/var/backups/cricketmatch` every night, keeping 14 of each                      |

The unit files, the Caddy block and the scripts are in `deploy/vps/`.

### Deploy

```bash
ssh root@161.97.97.34 /var/www/cricketmatch/deploy/vps/deploy.sh
```

It checks out `origin/main` (or the branch or commit you pass as the first argument), installs, builds, applies new `db/mysql/*.sql` files, restarts the service, and waits for it to answer. `NEXT_PUBLIC_SITE_URL` is read at build time, so change it with a deploy, not a restart.

### Database commands

Run these in `/var/www/cricketmatch` as the app user, for example `runuser -u cricketmatch -- env HOME=/var/lib/cricketmatch PATH=/opt/node24/bin:$PATH corepack pnpm db migrate`.

- `pnpm db migrate` applies `db/mysql/*.sql` files that have not run.
- `pnpm db load-fixtures data/fixtures/2026-27.json` adds the real fixtures and official ticket links in that file and updates the ones it loaded before. Add `--dry-run` to check the file first. The hourly sync does the same for every file in `data/fixtures`, so a deploy is enough; run this to apply a file at once. [data/fixtures/README.md](../data/fixtures/README.md) explains the format and the sourcing rules.
- `pnpm db seed-demo` loads the labelled DEMO catalogue. `pnpm db remove-demo` deletes it, with its offers, alerts and clicks.
- `pnpm db set-role <email> <role>` creates the account if needed and sets its role. `admin@cricketmatch.today` is the first admin.
- `pnpm db sign-in-link <email>` prints a one-time sign-in link, valid for 30 minutes. Use it when email cannot reach that address.

### Club and academy profiles

People create profiles from `/get-listed` after signing in. Each new profile waits at `/admin/profiles`, and every moderator and admin account is emailed about it. Approving makes the profile and its waiting matches public and emails the owner; sending it back needs a note, which the owner sees and is emailed. A moderator can take a live profile down the same way, which hides its matches too. Ticket links that owners add to their matches still wait at `/admin/ticket-links`.

Owners add a logo, a cover photo and up to 12 photos. The browser shrinks each picture before sending it; the server checks it is a JPEG, PNG, WebP, GIF, AVIF or TIFF, turns it upright, drops its camera and GPS data, and writes two WebP sizes to `UPLOAD_DIR/profiles`. Link previews use a JPEG copy, made the first time a chat app asks for it. A live profile's new pictures show at once; moderators see the last two weeks' at `/admin/profiles` and can take any down, which deletes its files. Pictures on a profile that waits for its check show only to its owner and moderators.

Owners can also add a season from a spreadsheet at `/dashboard/profiles/<slug>/matches/import`: an .xlsx or CSV file, or rows pasted from Excel or Google Sheets. The browser reads the file, so the server never opens a workbook; it gets the cells as text, checks every row as if posted from the match form, and shows what each row would do before anything is saved. Adding the same sheet again updates changed matches and skips the rest. The template is `public/templates/match-schedule.csv`.

### Search and link previews

- `app/sitemap.ts` lists the pages worth finding, with the time each match, its ticket links or a profile last changed. Filtered `/matches` views and places with nothing listed are noindex and stay out of it.
- Link previews are drawn by `lib/og.tsx`: `/og/site` once at build time, and `/og/match/<slug>` on request, kept by browsers and chat apps for an hour. They use Geist from `assets/fonts` (SIL Open Font License), because the image renderer cannot read the site's WOFF2 fonts.
- To verify the site in Google Search Console with the HTML tag method, put the token in `GOOGLE_SITE_VERIFICATION` in `.env` and run `systemctl restart cricketmatch`. A domain property, verified with a TXT record at Spaceship, covers `www` too.

### Backups

`cricketmatch-backup.timer` runs `deploy/vps/backup.sh` as the app user at about 03:40 server time. It writes `cricketmatch-<time>.sql.gz` with `mysqldump --single-transaction`, using the app's own database login from `.env`, and copies `UPLOAD_DIR` to `uploads-<time>/`. Pictures never change once written, so each night's copy hard-links the files the last one has and costs only the new ones. The newest 14 of each are kept in `/var/backups/cricketmatch` (mode 700). The copies are on the same disk, so they cover mistakes, not a lost server.

To keep a copy off the server, run this on a computer that can `ssh root@161.97.97.34`, then upload the folder to Google Drive:

```bash
deploy/vps/fetch-backup.sh --now
```

It makes `~/Downloads/cricketmatch-backup-<time>/` with the database dump, the pictures, the server's `.env` (in `settings/`, mode 600), a README with the restore steps, and checksums. Do it weekly, and before any risky change. Keep the Drive folder private: it holds people's email addresses and the site's keys. Without `ENCRYPTION_KEY` from that `.env`, a restored site cannot read the email addresses on ticket alerts.

To run one now and see the result:

```bash
systemctl start cricketmatch-backup.service && journalctl -u cricketmatch-backup.service -n 5 --no-pager
```

To restore, stop the app, load the dump, and copy the pictures back:

```bash
systemctl stop cricketmatch
gunzip -c /var/backups/cricketmatch/cricketmatch-<time>.sql.gz | mysql cricketmatch
rsync -a --delete /var/backups/cricketmatch/uploads-<time>/ /var/lib/cricketmatch/uploads/
chown -R cricketmatch:cricketmatch /var/lib/cricketmatch/uploads
systemctl start cricketmatch
```

### Node

`deploy/vps/install-node.sh` installs the newest Node 24 LTS into `/opt/node-v24.x.y-linux-x64` and points `/opt/node24` at it. It checks the download against Node's checksum file, and that file's signature against the release team's keys from GitHub. `deploy.sh` and `cricketmatch.service` use `/opt/node24`; the other apps keep the system's Node. To take a Node security release, run the script again, then deploy. Node 24 is supported until April 2028.

After changing a unit file in `deploy/vps/`, install it and reload systemd:

```bash
install -m 644 deploy/vps/cricketmatch.service /etc/systemd/system/ && systemctl daemon-reload
```

### Email

Until email is configured, mail is written to the service log, `journalctl -u cricketmatch`. To sign in without email at any time, print a link on the server:

```bash
cd /var/www/cricketmatch && runuser -u cricketmatch -- env HOME=/var/lib/cricketmatch corepack pnpm db sign-in-link admin@cricketmatch.today
```

cricketmatch.today sends mail with Resend, as kidspc.online does, and receives it with Spaceship's free email forwarding. The domain's DNS is at Spaceship.

1. **Sending.** cricketmatch.today is a Resend domain in `ap-northeast-1`, with open and click tracking off so sign-in links are not rewritten. Its records are a DKIM TXT record at `resend._domainkey`, an MX record and an SPF TXT record at `send`, and a CNAME at `rsend`. The server's `RESEND_API_KEY` can only send, and only for this domain.
2. **Receiving.** Spaceship's Email Forwarding sends `admin@` and `hello@` to a real inbox. Spaceship adds its own MX and SPF records at the root.
3. **DMARC.** A TXT record at `_dmarc`: `v=DMARC1; p=none; rua=mailto:hello@cricketmatch.today`.
4. **Settings.** `.env` has `RESEND_API_KEY` and `EMAIL_FROM="cricketmatch.today <hello@cricketmatch.today>"`. After changing `.env`, run `systemctl restart cricketmatch`.

Each email has an HTML part in the site's style and a plain-text part. The templates are in `lib/email/messages.ts`, and the images they load are in `public/email/`. `pnpm email:preview` writes every email, filled in with a DEMO match, to `.email-preview/`; `pnpm email:preview --send you@example.com` also sends them through the configured provider.

Any SMTP server can send instead. Set `SMTP_HOST`, `SMTP_PORT` (465 is TLS from the start, 587 is STARTTLS), `SMTP_USER` and `SMTP_PASS`. SMTP is used ahead of Resend when both are set.

### First install

`deploy/vps/` documents the steps that were run once: create the `cricketmatch` system user (home `/var/lib/cricketmatch`, so pnpm caches stay out of the checkout) and MySQL user, run `install-node.sh`, clone into `/var/www/cricketmatch`, write `.env` (with `UPLOAD_DIR=/var/lib/cricketmatch/uploads`), `pnpm install`, `pnpm build`, `pnpm db migrate`, install and enable `cricketmatch.service`, `cricketmatch-sync.timer` and `cricketmatch-backup.timer`, open 3300 to the Docker bridge in ufw, append `deploy/vps/Caddyfile` to the cricketverse Caddyfile, and `caddy reload` in the container.

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
