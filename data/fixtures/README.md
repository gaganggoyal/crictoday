# Fixture files

Each file lists real, scheduled matches that `pnpm db load-fixtures <file>` adds to the MySQL catalogue. The site shows each match's source link and the time it was last checked, so a fixture goes in only when it can be traced to an official page.

## Rules

- **Date, teams and ground** come from the home board, the ICC, or the league organiser.
- **Start time** comes from that source too. Where the board publishes no time, two independent services (for example Cricket Australia's match centre, Cricbuzz or ESPNcricinfo) must agree on it. If they disagree, leave the match out until the board confirms it.
- **Teams must be known.** Knockouts whose teams are decided later stay out until they are.
- **`start` is the ground's local time**, written `YYYY-MM-DDTHH:MM`, as boards publish it. The ground's `timezone` turns it into an instant.
- **`checkedAt`** is when the file was last compared with its sources. The match page shows it as the verification time.

## Format

- `countries`, `teams` and `venues` are registries keyed by slug. Each ground names its country and IANA time zone.
- Each entry in `series` names the competition, its season, the official `source` page, and its `matches`.
- A match's `key` is stable within its series. `fixtures:<series id>:<key>` is stored as the match's `source_external_id`, so loading the file again updates the same row.
- An optional `status` of `postponed` or `cancelled` keeps a match listed with that status.

## Updating

1. Edit the file, set `checkedAt`, and run `pnpm test`; `tests/domain/fixtures.test.ts` checks it.
2. On the server, run `pnpm db load-fixtures data/fixtures/2026-27.json --dry-run`, then without `--dry-run`.

Loading inserts new matches and updates changed ones in place, keeping their URLs. It never changes organiser or academy listings, and it skips a new match that has already started. Removing a match from the file does not delete it; set its `status` instead.

## 2026-27

Checked on 6 October 2026: 209 matches in 23 series, from 6 October 2026 to 8 April 2027. They are men's and women's internationals hosted by India, Australia, South Africa, New Zealand, Pakistan, Bangladesh and the UAE, plus the WBBL|12, BBL|16 and SA20 2027 regular seasons.

Waiting for confirmed start times (date and ground are confirmed):

- Pakistan v Sri Lanka T20Is, Rawalpindi, 9, 11 and 13 October: 7:30pm and 8pm are both reported.
- Afghanistan v Bangladesh Test, Abu Dhabi, from 9 October, and the Afghanistan v Zimbabwe Tests, Sharjah, from 5 and 13 November.
- India Women in South Africa, 9–30 December, as revised by Cricket South Africa.
- Bangladesh Women in New Zealand, 10–23 December, and Sri Lanka in New Zealand, 16 January – 16 February.
