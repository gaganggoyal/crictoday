# cricketmatch.today

Find the match. Feel the ground.

Upcoming cricket by country, ground, and local time, with an official or authorised way in when one has been reviewed. This repository is the Next.js app for that product.

## Run the demo

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000. The demo banner is intentional. Fixtures, prices, and ticket domains in that mode are illustrative. Demo sign-in addresses, local development only:

- `admin@cricketmatch.today`
- `moderator@cricketmatch.today`
- `organiser@cricketmatch.today`
- `academy@cricketmatch.today`

The sign-in page shows the magic link when demo roles are allowed. Nothing is emailed unless `RESEND_API_KEY` and `EMAIL_FROM` are set. With Supabase configured, sign-in uses Supabase magic links instead of the demo cookie.

## Checks

```bash
pnpm ci
pnpm test:e2e
```

`pnpm ci` is lint, typecheck, unit tests, and the production build. Playwright installs a browser on first run and drives `pnpm dev`.

## Production

Copy `.env.example` to `.env.local` and fill in the values you have. Leave `ALLOW_DEMO_DATA` unset on the public site. Without Supabase, a production process shows an empty catalog rather than the demo seed.

Read [docs/implementation-plan.md](docs/implementation-plan.md), [docs/deployment.md](docs/deployment.md), and [docs/production-checklist.md](docs/production-checklist.md) before deploying. Current gaps are in [docs/progress.md](docs/progress.md).
