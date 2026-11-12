# Mystery Cricketer data

[Mystery Cricketer](https://cricketmatch.today/games/mystery-cricketer) is the daily guess-the-cricketer game. These files hold the cricketers it knows and the order of the daily answers.

| File            | What it is                                                                                      | Edited by                       |
| --------------- | ----------------------------------------------------------------------------------------------- | ------------------------------- |
| `curated.json`  | The answer list by country, display names, nicknames and the few hand corrections, with reasons | Hand                            |
| `players.json`  | Every guessable cricketer and his seven clues                                                   | `scripts/game/build_players.py` |
| `schedule.json` | Puzzle 1's date and the answer for each day after it                                            | `scripts/game/build_players.py` |

## Who is in it

- **Guessable:** every man who has played a Test, ODI or T20 international for one of the 12 Full Members since 2012, about 1,300 players. A player whose sources leave out a clue is left out, and the build lists him.
- **Answers:** the 193 well-known players named in `curated.json`: current stars and recent greats, weighted towards India. Each must be guessable; the build stops if one is not.

## Where each clue comes from

| Clue          | Source and rule                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Country       | The national side he played the most internationals for, from Cricsheet. Close: the same region (Asia, Oceania, Europe, Africa).                                                                              |
| Role          | Wikipedia's infobox role: batter, bowler, all-rounder or keeper. An all-rounder who seldom bowls counts as a batter.                                                                                          |
| Bowls         | Wikipedia's bowling style, grouped as right- or left-arm pace, off-spin, leg-spin, left-arm orthodox or left-arm wrist spin. Shown only if he bowled in at least a quarter of his internationals (Cricsheet). |
| Bats          | Wikipedia's batting hand.                                                                                                                                                                                     |
| Age           | Worked out on the puzzle's date from his Wikipedia date of birth.                                                                                                                                             |
| Debut         | The year of his first international, from Wikipedia; for a player who changed countries, his first for the country shown (Cricsheet).                                                                         |
| Last IPL team | The franchise he last played an IPL match for, from Cricsheet. Answers also keep every franchise they played for, for the "close" rule.                                                                       |

[Cricsheet](https://cricsheet.org) publishes every men's international and IPL match under the Open Data Commons Attribution License, so the game page credits it. Cricsheet withholds matches involving Afghanistan's men's team, so Afghanistan's players come from Wikipedia's lists of Afghanistan international cricketers, and "Bowls" for them uses balls bowled per international from the infobox (at least six). Their IPL records still come from Cricsheet.

Wikidata only links each player's ESPNcricinfo ID to his Wikipedia page. Where Wikidata and Wikipedia disagree on a date of birth, Wikipedia wins: Wikidata had, for example, Tom Latham born in 1923.

## Updating

Refresh after each IPL season, and whenever new players should be guessable:

```bash
python3 scripts/game/build_players.py            # downloads Cricsheet and Wikipedia again
python3 scripts/game/build_players.py --offline  # rebuilds from the last download
pnpm test tests/game                             # checks the data and the schedule
```

It needs Python 3.9 or later and nothing else. Downloads are cached in `.data/game-sources`, which git ignores. Read the notes the build prints, and look at the diff of `players.json` before you commit it: each player is on his own line.

- **A wrong clue:** if Wikipedia is wrong, correct Wikipedia, then rebuild. If the rule is the problem, as with a batter Wikipedia calls an all-rounder, add an override with its reason under `overrides` in `curated.json`.
- **Adding or removing an answer:** edit `answers` in `curated.json` and rebuild. The current schedule keeps working: a removed answer's days need a new schedule (below), and an added one only appears in a new schedule.
- **A new schedule:** `--schedule YYYY-MM-DD` writes two shuffled passes through the answers, about a year, with no country on two days running. Puzzle 1 is that date. Never change a schedule for a day that has already started anywhere, because players' saved games would no longer match. After its last day the schedule starts again from the top.

The schedule stays on the server: a page gets only the answers for the dates some time zone is on, so the answers to come are not in the browser.
