# Fixture files

Each file lists real, scheduled matches for the MySQL catalogue, with each match's official ticket link where one exists. The site shows each match's source link and the time it was last checked, so a fixture goes in only when it can be traced to an official page.

## Rules

- **Date, teams and ground** come from the home board, the ICC, or the league organiser.
- **Start time** comes from that source too. Where the board publishes no time, two independent services (for example Cricket Australia's match centre, Cricbuzz or ESPNcricinfo) must agree on it. If they disagree, leave the match out until the board confirms it.
- **Teams must be known.** Knockouts whose teams are decided later stay out until they are.
- **`start` is the ground's local time**, written `YYYY-MM-DDTHH:MM`, as boards publish it. The ground's `timezone` turns it into an instant.
- **An Indian ground's town must be in [lib/data/india.ts](../../lib/data/india.ts)**, so the match appears on its state and city pages. Add the town under its state first.
- **`checkedAt`** is when the file was last compared with its sources. The match page shows it as the verification time, and a match not checked for a week says so, as the home page promises. A series whose source could not be read keeps its own, earlier `checkedAt`, so its matches never claim a check that did not happen.
- **Ticket links are official only.** A link is the board's or organiser's own ticket page, or the event page of the seller it names, such as Cricket Australia's Ticketek and Ticketmaster links or a state association's District page. Resale and travel sites never go in.

## Format

- `countries`, `teams` and `venues` are registries keyed by slug. Each ground names its country and IANA time zone.
- Each entry in `series` names the competition, its season, the official `source` page, and its `matches`. An optional `checkedAt` on a series overrides the file's for its matches.
- A match's `key` is stable within its series. `fixtures:<series id>:<key>` is stored as the match's `source_external_id`, so loading the file again updates the same row, keeping its address. A match whose address would name the wrong town, such as one moved before it was ever shown, can take a new key; the old row keeps its status.
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

209 matches in 23 series, from 6 October 2026 to 8 April 2027. They are men's and women's internationals hosted by India, Australia, South Africa, New Zealand, Pakistan, Bangladesh and the UAE, plus the WBBL|12, BBL|16 and SA20 2027 regular seasons.

Checked on 13 November 2026, against each series' own source, for the 140 matches still to come in 13 series. Four matches keep the check of 6 October, because their sources could not be read on 13 November: India's 5th ODI and two Tests in New Zealand (New Zealand Cricket's fixture and ticket sites did not answer) and Pakistan v Sri Lanka, 2nd Test, Lahore (the PCB's site refuses automated reading). The series already played keep 6 October too.

The 13 November check changed:

- **India v Sri Lanka, 1st ODI, 13 December**, from Delhi to the ACA-VDCA Cricket Stadium in Visakhapatnam, as [the BCCI announced on 5 November](https://www.bcci.tv/news/article/first-odi-between-india-and-sri-lanka-shifted-from-delhi-to-visakhapatnam). Its new key, `odi-1-visakhapatnam`, gives it an address that names Visakhapatnam; the hidden Delhi row stays hidden.
- **South Africa v Bangladesh:** Cricket South Africa's ticket shop gives later start times for the 1st ODI (10am, not 1:30pm) and the 2nd and 3rd T20Is (6pm, not 2:30pm).
- **South Africa Women v Australia Women:** six of the seven ticket events in Cricket South Africa's shop show dates that differ from Women's Cricket South Africa's fixtures, or a closed sale, so their links are withdrawn until the two agree. The 3rd ODI's link matches and stays.
- **SA20:** Season 5 tickets went on sale on 5 November at SA20's own ticket site, run by Fever, so every league match links to it.
- **Australia:** every date, start time and ground matches Cricket Australia's fixture data. That data now links the New Zealand Women ODIs in March, and no longer links the 150th Anniversary Test, so that link is withdrawn.

171 matches have official ticket links:

- **Australia, 101:** Cricket Australia's own fixture data for the internationals, WBBL and BBL, and District for the BBL match in Chennai.
- **SA20, 30:** SA20's ticket site.
- **South Africa, 18:** Cricket South Africa's Ticketpro shop. Tests link to their first day.
- **New Zealand, 12:** New Zealand Cricket's ticket site. The Wellington matches link to their own pages.
- **Pakistan, 6:** the tri-series at the PCB's ticket site.
- **India, 4:** the West Indies T20Is in Lucknow, Ranchi and Indore on District, and Hyderabad on ticketgenie.

Ticketek and Ticketmaster refuse automated reading, so the links in Cricket Australia's data are checked against that data, not the sellers' pages: a sold-out Australian match shows as on sale until someone marks it by hand.

Waiting for confirmed start times (date and ground are confirmed):

- India Women in South Africa, 9–30 December. Women's Cricket South Africa lists the dates and grounds, but no start times.
- Bangladesh Women in New Zealand, 10–23 December, and Sri Lanka in New Zealand, 16 January – 16 February.

Waiting for an official ticket link: India's home series against Sri Lanka, Zimbabwe and Australia (the BCCI has named no seller), South Africa Women v Australia Women except the 3rd ODI, the 150th Anniversary Test, and Pakistan v Sri Lanka in Lahore.
