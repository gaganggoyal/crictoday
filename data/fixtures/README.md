# Fixture files

Each file lists real, scheduled matches for the MySQL catalogue, with each match's official ticket link where one exists. The site shows each match's source link and the time it was last checked, so a fixture goes in only when it can be traced to an official page.

## Rules

- **Date, teams and ground** come from the home board, the ICC, or the league organiser.
- **Start time** comes from that source too. Where the board publishes no time, two independent services (for example Cricket Australia's match centre, Cricbuzz or ESPNcricinfo) must agree on it. If they disagree, leave the match out until the board confirms it.
- **Teams must be known.** Knockouts whose teams are decided later stay out until they are.
- **`start` is the ground's local time**, written `YYYY-MM-DDTHH:MM`, as boards publish it. The ground's `timezone` turns it into an instant.
- **An Indian ground's town must be in [lib/data/india.ts](../../lib/data/india.ts)**, so the match appears on its state and city pages. Add the town under its state first.
- **`checkedAt`** is when the file was last compared with its sources. The match page shows it as the verification time.
- **Ticket links are official only.** A link is the board's or organiser's own ticket page, or the event page of the seller it names, such as Cricket Australia's Ticketek and Ticketmaster links or a state association's District page. Resale and travel sites never go in.

## Format

- `countries`, `teams` and `venues` are registries keyed by slug. Each ground names its country and IANA time zone.
- Each entry in `series` names the competition, its season, the official `source` page, and its `matches`.
- A match's `key` is stable within its series. `fixtures:<series id>:<key>` is stored as the match's `source_external_id`, so loading the file again updates the same row.
- An optional `status` of `postponed` or `cancelled` keeps a match listed with that status. `draft` hides it, for example while a moved match waits for its new ground.
- An optional `tickets` object on a match, or on a series for all its matches, gives the official link:
  - `seller` is the name shown, and `url` is the full `https` link.
  - `status` is `active` (the default) or `sold_out`.
  - `onSale` is the ground's local time when sales open. Until then the match is listed without the link.

## Updating

1. Edit the file, set `checkedAt`, and run `pnpm test`; `tests/domain/fixtures.test.ts` checks it.
2. Deploy. The hourly sync loads every file in this folder, so changes and links whose sale has opened go live within the hour. To load at once, run `pnpm db load-fixtures data/fixtures/2026-27.json` on the server, with `--dry-run` first to check the file.

Loading inserts new matches and updates changed ones in place, keeping their URLs. It never changes organiser or academy listings, and it skips a new match that has already started. Removing a match from the file does not delete it; set its `status` instead.

Ticket links follow the file: a listed link is approved and public, a changed one is updated, and one the file drops is withdrawn. A blocked seller domain is never listed. When a link goes live, anyone with a ticket alert for that match is emailed in the same sync. A match's verification time only moves forward, so a moderator's later check is kept.

## 2026-27

Checked on 6 October 2026: 209 matches in 23 series, from 6 October 2026 to 8 April 2027. They are men's and women's internationals hosted by India, Australia, South Africa, New Zealand, Pakistan, Bangladesh and the UAE, plus the WBBL|12, BBL|16 and SA20 2027 regular seasons.

145 matches have official ticket links:

- **Australia, 99:** Cricket Australia's own fixture data for the internationals, WBBL and BBL; its ticketing page for the 150th Anniversary Test; and District for the BBL match in Chennai, from 10 October at 6pm IST.
- **South Africa, 24:** Cricket South Africa's Ticketpro shop. Tests link to their first day.
- **New Zealand, 12:** New Zealand Cricket's ticket site. The Wellington matches link to their own pages.
- **India, 4:** the West Indies T20Is in Lucknow, Ranchi and Indore on District, and Hyderabad on ticketgenie.
- **Pakistan, 6:** the tri-series at the PCB's ticket site, from 10 October at 3pm.

Hidden until the BCCI names a new ground: India v Sri Lanka, 1st ODI, 13 December. The Delhi association has told the BCCI that Arun Jaitley Stadium cannot host it.

Waiting for confirmed start times (date and ground are confirmed):

- Pakistan v Sri Lanka T20Is, Rawalpindi, 9, 11 and 13 October: 7:30pm and 8pm are both reported.
- Afghanistan v Bangladesh Test, Abu Dhabi, from 9 October, and the Afghanistan v Zimbabwe Tests, Sharjah, from 5 and 13 November.
- India Women in South Africa, 9–30 December, as revised by Cricket South Africa. Its ticket shop lists them, but not their start times.
- Bangladesh Women in New Zealand, 10–23 December, and Sri Lanka in New Zealand, 16 January – 16 February.

Waiting for an official ticket link: the Bengaluru T20I (ticketgenie has not opened it), the later India series, the India Women v Zimbabwe Women series, SA20 (SA20 says later this year), the Sri Lanka Tests in Pakistan, the UAE series, Bangladesh v West Indies, and the New Zealand Women ODIs in March.
