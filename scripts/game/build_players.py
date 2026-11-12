"""
Builds data/game/players.json, the cricketers Mystery Cricketer knows, from public records.

    python3 scripts/game/build_players.py                 # download, merge, write
    python3 scripts/game/build_players.py --offline       # reuse the last download
    python3 scripts/game/build_players.py --schedule 2026-11-12   # also write a new schedule

Sources, in the order they are trusted:

- Cricsheet (https://cricsheet.org, ODC-By 1.0) for every men's Test, ODI, T20I and IPL match:
  who played for which country, how often each player bowled, and each IPL franchise.
- English Wikipedia's cricketer infobox for batting hand, bowling style, role, date of birth and
  international debut.
- Wikidata, only to find each player's Wikipedia page from his ESPNcricinfo ID, and as a fallback
  date of birth.
- data/game/curated.json: the answer list, display names, nicknames and the few overrides, each
  with its reason.

Cricsheet withholds matches involving Afghanistan's men's team, so Afghanistan's players come
from Wikipedia's lists of Afghanistan international cricketers; their IPL records still come from
Cricsheet. Only the Python standard library is used. Downloads are cached in .data/game-sources.
"""

import argparse
import csv
import datetime
import io
import json
import random
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "game" / "players.json"
SCHEDULE = ROOT / "data" / "game" / "schedule.json"
CURATED = ROOT / "data" / "game" / "curated.json"
USER_AGENT = "cricketmatch.today-game-data/1.0 (https://cricketmatch.today/contact)"

FULL_MEMBERS = {
    "Afghanistan", "Australia", "Bangladesh", "England", "India", "Ireland", "New Zealand",
    "Pakistan", "South Africa", "Sri Lanka", "West Indies", "Zimbabwe",
}
# Composite sides are not a player's country.
NOT_A_COUNTRY = {"ICC World XI", "Asia XI", "Africa XI", "World XI"}
# A player is guessable if he played for a Full Member and his last international was this recent.
POOL_SINCE = "2012-01-01"
# "Bowls" shows a style only for players who bowled in at least this share of their internationals.
BOWLED_SHARE = 0.25
# For Afghanistan, from Wikipedia's career table: balls bowled per international.
AFGHAN_BALLS_PER_MATCH = 6

ARCHIVES = {"tests_male_json": "test", "odis_male_json": "odi", "t20s_male_json": "t20i", "ipl_male_json": "ipl"}
IPL_CODES = {
    "Chennai Super Kings": "CSK",
    "Mumbai Indians": "MI",
    "Royal Challengers Bangalore": "RCB",
    "Royal Challengers Bengaluru": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Sunrisers Hyderabad": "SRH",
    "Delhi Daredevils": "DC",
    "Delhi Capitals": "DC",
    "Kings XI Punjab": "PBKS",
    "Punjab Kings": "PBKS",
    "Rajasthan Royals": "RR",
    "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
    "Deccan Chargers": "DCG",
    "Gujarat Lions": "GL",
    "Kochi Tuskers Kerala": "KTK",
    "Pune Warriors": "PWI",
    "Rising Pune Supergiant": "RPS",
    "Rising Pune Supergiants": "RPS",
}
NOT_BOWLERS_WICKET = {
    "run out", "retired hurt", "retired out", "retired not out", "obstructing the field",
    "handled the ball", "timed out",
}


# ---------------------------------------------------------------- downloads


def fetch(url, data=None, accept="application/json"):
    for attempt in range(6):
        try:
            request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, "Accept": accept})
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read()
        except Exception as error:  # noqa: BLE001 - retried, then reported
            if attempt == 5:
                raise SystemExit(f"Could not fetch {url}: {error}")
            time.sleep(10 * (attempt + 1))


def cached(cache, name, offline, produce):
    path = cache / name
    if path.exists() and offline:
        return json.loads(path.read_text())
    value = produce()
    path.write_text(json.dumps(value))
    return value


def download_cricsheet(cache, offline):
    folder = cache / "cricsheet"
    folder.mkdir(parents=True, exist_ok=True)
    for name in list(ARCHIVES) + ["people"]:
        target = folder / (f"{name}.zip" if name != "people" else "people.csv")
        if offline and target.exists():
            continue
        url = f"https://cricsheet.org/downloads/{name}.zip" if name != "people" else "https://cricsheet.org/register/people.csv"
        print(f"Downloading {url}")
        target.write_bytes(fetch(url, accept="*/*"))
    return folder


# ---------------------------------------------------------------- Cricsheet


def blank_player():
    return {
        "formats": {},
        "teams": {},
        "balls_bowled": 0,
        "bowled_in": 0,
        "ipl": [],
        "name": None,
    }


def read_cricsheet(folder):
    players = defaultdict(blank_player)
    for archive, kind in ARCHIVES.items():
        with zipfile.ZipFile(folder / f"{archive}.zip") as bundle:
            for entry in bundle.namelist():
                if not entry.endswith(".json"):
                    continue
                match = json.loads(bundle.read(entry))
                info = match["info"]
                if info.get("gender") != "male":
                    continue
                date = info["dates"][0]
                registry = info["registry"]["people"]
                for team, names in info["players"].items():
                    for name in names:
                        player = players[registry[name]]
                        player["name"] = name
                        if kind == "ipl":
                            player["ipl"].append((date, team))
                            continue
                        stint = player["formats"].setdefault(kind, {"matches": 0, "first": date, "last": date})
                        stint["matches"] += 1
                        stint["first"] = min(stint["first"], date)
                        stint["last"] = max(stint["last"], date)
                        side = player["teams"].setdefault(team, {"matches": 0, "first": date})
                        side["matches"] += 1
                        side["first"] = min(side["first"], date)
                if kind == "ipl":
                    continue
                bowled = set()
                for innings in match.get("innings", []):
                    for over in innings.get("overs", []):
                        for ball in over["deliveries"]:
                            bowler = registry[ball["bowler"]]
                            extras = ball.get("extras", {})
                            if "wides" not in extras and "noballs" not in extras:
                                players[bowler]["balls_bowled"] += 1
                            bowled.add(bowler)
                for bowler in bowled:
                    players[bowler]["bowled_in"] += 1
    for player in players.values():
        player["ipl"].sort()
    return players


def main_team(player):
    sides = {team: side for team, side in player["teams"].items() if team not in NOT_A_COUNTRY}
    if not sides:
        return None
    return max(sides.items(), key=lambda item: item[1]["matches"])[0]


def international_matches(player):
    return sum(stint["matches"] for stint in player["formats"].values())


def last_international(player):
    return max((stint["last"] for stint in player["formats"].values()), default="")


# ---------------------------------------------------------------- Wikipedia and Wikidata


def sparql(query):
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    raw = fetch("https://query.wikidata.org/sparql", data=body, accept="application/sparql-results+json")
    return json.loads(raw)["results"]["bindings"]


def wikidata_by_cricinfo(cricinfo_ids):
    """ESPNcricinfo ID -> {titles, births} from Wikidata."""
    found = defaultdict(lambda: {"titles": set(), "births": set()})
    ids = sorted(cricinfo_ids)
    for start in range(0, len(ids), 200):
        values = " ".join(f'"{value}"' for value in ids[start : start + 200])
        rows = sparql(
            f"""SELECT ?id ?title ?birth WHERE {{
              VALUES ?id {{ {values} }}
              ?item wdt:P2697 ?id .
              OPTIONAL {{ ?item wdt:P569 ?birth . }}
              OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title . }}
            }}"""
        )
        for row in rows:
            entry = found[row["id"]["value"]]
            if "title" in row:
                entry["titles"].add(row["title"]["value"])
            if "birth" in row:
                entry["births"].add(row["birth"]["value"][:10])
        time.sleep(1)
    return {key: {"titles": sorted(v["titles"]), "births": sorted(v["births"])} for key, v in found.items()}


def wikipedia_pages(titles, props="revisions", whole=False):
    """Title -> {title, text, wikibase} for each page, following redirects. Unless whole is set,
    text keeps only the cricketer infobox, which is all the build reads."""
    pages = {}
    titles = sorted(set(titles))
    for start in range(0, len(titles), 25):
        chunk = titles[start : start + 25]
        params = {
            "action": "query",
            "prop": props,
            "rvprop": "content",
            "rvslots": "main",
            "redirects": "1",
            "format": "json",
            "formatversion": "2",
            "titles": "|".join(chunk),
        }
        data = json.loads(fetch("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)))
        query = data["query"]
        normalized = {x["to"]: x["from"] for x in query.get("normalized", [])}
        redirects = {x["to"]: x["from"] for x in query.get("redirects", [])}
        for page in query["pages"]:
            if "revisions" not in page:
                continue
            asked = redirects.get(page["title"], page["title"])
            asked = normalized.get(asked, asked)
            text = page["revisions"][0]["slots"]["main"]["content"]
            pages[asked] = {
                "title": page["title"],
                "text": text if whole else (template_body(text, "Infobox cricketer") or ""),
                "wikibase": page.get("pageprops", {}).get("wikibase_item"),
            }
        time.sleep(2)
    return pages


def template_body(text, name):
    match = re.search(r"\{\{\s*" + name, text, re.I)
    if not match:
        return None
    depth, i = 0, match.start()
    while i < len(text):
        if text.startswith("{{", i):
            depth += 1
            i += 2
            continue
        if text.startswith("}}", i):
            depth -= 1
            i += 2
            if depth == 0:
                break
            continue
        i += 1
    return text[match.start() : i]


def split_top_level(body, depth_start=1):
    depth, start, parts, i = 0, 0, [], 0
    while i < len(body):
        pair = body[i : i + 2]
        if pair in ("{{", "[["):
            depth += 1
            i += 2
            continue
        if pair in ("}}", "]]"):
            depth -= 1
            i += 2
            continue
        if body[i] == "|" and depth == depth_start:
            parts.append(body[start:i])
            start = i + 1
        i += 1
    parts.append(body[start:])
    return parts


def infobox(text):
    body = template_body(text, "Infobox cricketer")
    if not body:
        return None
    fields = {}
    for part in split_top_level(body)[1:]:
        if "=" in part:
            key, value = part.split("=", 1)
            fields[key.strip()] = value.strip()
    return fields


def clean(text):
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text or "", flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"\{\{\s*(?:efn|sfn|sfnm|refn|cn|citation needed)\b[^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*\}\}", "", text, flags=re.I)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\{\{\s*(?:nowrap|small)\s*\|([^{}]*)\}\}", r"\1", text, flags=re.I)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("}}", "").replace("{{", "").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", text).strip()


def first_item(raw):
    """The first entry of a {{ubl|...}}-style list or of a bulleted list, else the text."""
    raw = raw or ""
    match = re.search(r"\{\{\s*(?:ubl|unbulleted list|plainlist|flatlist|hlist)\s*\|(.*)\}\}", raw, re.I | re.S)
    if match:
        items = [x for x in split_top_level(match.group(1), depth_start=0) if x.strip() and "=" not in x.split("[[")[0]]
        if items:
            return items[0]
    lines = [line.lstrip("* ").strip() for line in raw.splitlines() if line.strip()]
    return lines[0] if lines else raw


def batting_hand(raw):
    text = clean(raw).lower()
    return "L" if "left" in text else "R" if "right" in text else None


def bowling_style(raw):
    text = clean(first_item(raw)).lower().replace("-", " ")
    if not text or text in ("none", "n/a"):
        return None
    first = re.split(r",|/| and | occasional |;", text)[0]
    for part in (first, text):
        if "wrist" in part or "unorthodox" in part or "chinaman" in part or ("left arm" in part and "leg" in part):
            return "left-wrist"
        if "orthodox" in part or "slow left" in part or ("left arm" in part and ("spin" in part or "slow" in part or "off" in part)):
            return "left-finger"
        if "leg" in part or "googly" in part:
            return "leg-spin"
        if "off" in part:
            return "off-spin"
        if any(word in part for word in ("fast", "medium", "seam", "swing")):
            return "left-pace" if "left" in part else "right-pace"
    return None


def playing_role(raw):
    text = clean(raw).lower()
    if not text:
        return None
    text = re.split(r",?\s*(?:occasional|occasionally)", text)[0]
    if "keeper" in text:
        return "wk"
    if "all" in text and "round" in text:
        return "ar"
    if "bowl" in text:
        return "bowl"
    if "bat" in text:
        return "bat"
    return None


def year_in(raw):
    match = re.search(r"(1[89]\d\d|20\d\d)", clean(raw))
    return int(match.group(1)) if match else None


def birth_date(raw):
    match = re.search(
        r"\{\{\s*birth[ _]date(?: and age)?\s*\|(?:[^|}]*=[^|}]*\|)*\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})",
        raw or "",
        re.I,
    )
    if not match:
        return None
    return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


DEBUT_FIELDS = [
    "test_debut_year", "testdebutyear", "odi_debut_year", "odidebutyear", "t20i_debut_year",
    "T20Idebutyear", "debutyear1", "debutyear2", "debut_year1", "debut_year2",
]
SPAN_FIELDS = ["international_span", "internationalspan", "international_span2", "internationalspan2"]


def debut_year(box):
    years = [y for y in (year_in(box.get(key)) for key in DEBUT_FIELDS) if y]
    spans = [y for y in (year_in(box.get(key)) for key in SPAN_FIELDS) if y]
    return min(years or spans) if (years or spans) else None


def display_name(title):
    return re.sub(r"\s*\(.*\)$", "", title).strip()


def slug(text):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


# ---------------------------------------------------------------- Afghanistan


def afghanistan_titles(offline, cache):
    def produce():
        titles = set()
        for page in ["List of Afghanistan Test cricketers", "List of Afghanistan ODI cricketers", "List of Afghanistan Twenty20 International cricketers"]:
            text = wikipedia_pages([page], whole=True)[page]["text"]
            # Each row names the player with {{sortname|first|last|link|dab=...}}, then his first and last years.
            for match in re.finditer(r"\{\{\s*sortname\s*\|([^}]*)\}\}[^\n]*\n\|\s*(\d{4})\s*\|\|\s*(\d{4})", text, re.I):
                args = [a.strip() for a in match.group(1).split("|")]
                named = dict(a.split("=", 1) for a in args if "=" in a)
                positional = [a for a in args if "=" not in a]
                first, last = (positional + ["", ""])[:2]
                link = positional[2] if len(positional) > 2 and positional[2] else " ".join(x for x in (first, last) if x)
                if named.get("dab"):
                    link += f" ({named['dab'].strip()})"
                if int(match.group(3)) >= int(POOL_SINCE[:4]):
                    titles.add(link)
        return sorted(titles)

    return cached(cache, "afghanistan-titles.json", offline, produce)


def career_table(box):
    """International matches and balls bowled from the infobox's Test, ODI and T20I columns."""
    def number(raw):
        match = re.search(r"\d[\d,]*", clean(raw))
        return int(match.group(0).replace(",", "")) if match else 0

    matches = balls = 0
    for column in range(1, 6):
        if clean(box.get(f"column{column}", "")) in ("Test", "ODI", "T20I"):
            matches += number(box.get(f"matches{column}"))
            balls += number(box.get(f"deliveries{column}") or box.get(f"balls{column}"))
    return matches, balls


# ---------------------------------------------------------------- building


def build(args):
    cache = ROOT / ".data" / "game-sources"
    cache.mkdir(parents=True, exist_ok=True)
    curated = json.loads(CURATED.read_text())
    problems = []

    folder = download_cricsheet(cache, args.offline)
    print("Reading Cricsheet matches")
    cricsheet = read_cricsheet(folder)
    register = {}
    by_cricinfo = {}
    with open(folder / "people.csv", newline="") as handle:
        for row in csv.DictReader(handle):
            register[row["identifier"]] = row
            for key in ("key_cricinfo", "key_cricinfo_2", "key_cricinfo_3"):
                if row[key]:
                    by_cricinfo[row[key]] = row["identifier"]

    pool = {
        pid: player
        for pid, player in cricsheet.items()
        if player["formats"] and main_team(player) in FULL_MEMBERS and last_international(player) >= POOL_SINCE
    }
    cricinfo_of = {}
    for pid in pool:
        row = register.get(pid, {})
        ids = [row.get(key) for key in ("key_cricinfo", "key_cricinfo_2") if row.get(key)]
        if ids:
            cricinfo_of[pid] = ids
    print(f"{len(pool)} men played for a Full Member since {POOL_SINCE}; looking them up on Wikidata")
    wikidata = cached(cache, "wikidata.json", args.offline, lambda: wikidata_by_cricinfo({i for ids in cricinfo_of.values() for i in ids}))

    title_of = {}
    births_of = {}
    for pid, ids in cricinfo_of.items():
        for cricinfo in ids:
            entry = wikidata.get(cricinfo)
            if entry and entry["titles"]:
                title_of[pid] = entry["titles"][0]
                births_of[pid] = entry["births"]
                break
    print(f"Fetching {len(title_of)} Wikipedia pages")
    pages = cached(cache, "wikipedia.json", args.offline, lambda: wikipedia_pages(title_of.values()))

    afghan_titles = afghanistan_titles(args.offline, cache)
    print(f"Fetching {len(afghan_titles)} Afghanistan players' Wikipedia pages")
    afghan_pages = cached(cache, "wikipedia-afghanistan.json", args.offline, lambda: wikipedia_pages(afghan_titles, props="revisions|pageprops"))
    afghan_items = sorted({page["wikibase"] for page in afghan_pages.values() if page.get("wikibase")})

    def afghan_ids():
        values = " ".join(f"wd:{item}" for item in afghan_items)
        rows = sparql(f"SELECT ?item ?id WHERE {{ VALUES ?item {{ {values} }} ?item wdt:P2697 ?id . }}")
        return {row["item"]["value"].rsplit("/", 1)[-1]: row["id"]["value"] for row in rows}

    afghan_cricinfo = cached(cache, "wikidata-afghanistan.json", args.offline, afghan_ids)

    records = []
    for pid, player in pool.items():
        name = register.get(pid, {}).get("unique_name") or player["name"]
        page = pages.get(title_of.get(pid, ""))
        box = infobox(page["text"]) if page else None
        if not box:
            problems.append((name, "no Wikipedia infobox, left out"))
            continue
        country = main_team(player)
        matches = international_matches(player)
        bowls = player["bowled_in"] / matches >= BOWLED_SHARE
        record = {
            "source": "cricsheet",
            "wiki": page["title"],
            "name": display_name(page["title"]),
            "cricsheet": name,
            "country": country,
            "bats": batting_hand(box.get("batting")),
            "style": bowling_style(box.get("bowling")),
            "bowls_regularly": bowls,
            "role": playing_role(box.get("role")),
            "balls_per_match": player["balls_bowled"] / matches,
            "born": birth_date(box.get("birth_date")),
            "debut": debut_year(box),
            "ipl": player["ipl"],
        }
        if not record["born"] and len(births_of.get(pid, [])) == 1:
            record["born"] = births_of[pid][0]
        # A player who changed countries: his debut for the country the clue shows.
        countries = [team for team in player["teams"] if team not in NOT_A_COUNTRY]
        if len(countries) > 1:
            record["debut"] = int(player["teams"][country]["first"][:4])
        if record["debut"] is None:
            record["debut"] = int(min(stint["first"] for stint in player["formats"].values())[:4])
            problems.append((record["name"], f"no debut on Wikipedia, used Cricsheet's {record['debut']}"))
        records.append(record)

    for title, page in afghan_pages.items():
        box = infobox(page["text"])
        if not box:
            continue
        matches, balls = career_table(box)
        if matches == 0:
            problems.append((title, "Afghanistan: no career table, left out"))
            continue
        pid = by_cricinfo.get(afghan_cricinfo.get(page.get("wikibase") or "", ""), "")
        records.append(
            {
                "source": "wikipedia",
                "wiki": page["title"],
                "name": display_name(page["title"]),
                "cricsheet": None,
                "country": "Afghanistan",
                "bats": batting_hand(box.get("batting")),
                "style": bowling_style(box.get("bowling")),
                "bowls_regularly": balls / matches >= AFGHAN_BALLS_PER_MATCH,
                "role": playing_role(box.get("role")),
                "balls_per_match": balls / matches,
                "born": birth_date(box.get("birth_date")),
                "debut": debut_year(box),
                "ipl": cricsheet[pid]["ipl"] if pid in cricsheet else [],
                }
        )

    # Rules, then the curated names and overrides.
    renames = curated["names"]
    for record in records:
        record["name"] = renames.get(record["name"], record["name"])
        record["bowls"] = record["style"] if record["bowls_regularly"] else None
        if record["role"] is None:
            record["role"] = "bowl" if record["bowls_regularly"] and record["balls_per_match"] >= 18 else "bat"
        # An all-rounder who seldom bowls reads as a batter.
        if record["role"] == "ar" and not record["bowls"]:
            record["role"] = "bat"
    # Two people with one name: the one whose Wikipedia title is qualified gets his country or year.
    names = Counter(record["name"] for record in records)
    for record in records:
        if names[record["name"]] > 1 and "(" in record["wiki"]:
            record["name"] = f"{record['name']} (born {record['born'][:4]})" if record["born"] else f"{record['name']} ({record['country']})"
    by_name = defaultdict(list)
    for record in records:
        by_name[record["name"]].append(record)
    for name, override in curated["overrides"].items():
        if len(by_name.get(name, [])) != 1:
            problems.append((name, "override names nobody, or more than one player"))
            continue
        for key, value in override.items():
            if key != "why":
                by_name[name][0][key] = value

    # Ids.
    ids = Counter(slug(record["name"]) for record in records)
    for record in records:
        record["id"] = slug(record["name"]) if ids[slug(record["name"])] == 1 else f"{slug(record['name'])}-{slug(record['country'])}"

    # Required clues; a player without them cannot be guessed.
    complete = []
    for record in records:
        missing = [key for key in ("bats", "born", "debut", "role") if not record.get(key)]
        if record["bowls_regularly"] and not record["style"]:
            missing.append("bowling style")
        if missing:
            problems.append((record["name"], f"missing {', '.join(missing)}, left out"))
            continue
        complete.append(record)
    by_name = {record["name"]: record for record in complete}

    answers = []
    for country, names in curated["answers"].items():
        for name in names:
            record = by_name.get(name)
            if not record:
                raise SystemExit(f"Answer {name!r} is not among the guessable players. Check the spelling or the sources.")
            if record["country"] != country:
                raise SystemExit(f"Answer {name!r} plays for {record['country']}, not {country}.")
            answers.append(record["id"])
    answer_ids = set(answers)

    aliases = curated["aliases"]
    players = []
    for record in sorted(complete, key=lambda r: (r["country"], r["name"])):
        ipl = record["ipl"]
        player = {
            "id": record["id"],
            "name": record["name"],
            "country": record["country"],
            "role": record["role"],
            "bats": record["bats"],
            "bowls": record["bowls"],
            "born": record["born"],
            "debut": record["debut"],
            "ipl": IPL_CODES[ipl[-1][1]] if ipl else None,
        }
        aka = [a for a in aliases.get(record["name"], []) if a != record["name"]]
        if aka:
            player["aka"] = aka
        if record["id"] in answer_ids:
            player["answer"] = True
            player["iplTeams"] = sorted({IPL_CODES[team] for _, team in ipl})
        players.append(player)
    unknown = {team for record in complete for _, team in record["ipl"] if team not in IPL_CODES}
    if unknown:
        raise SystemExit(f"Unknown IPL teams: {sorted(unknown)}")

    lines = ",\n".join("    " + json.dumps(player, ensure_ascii=False, separators=(",", ":")) for player in players)
    OUT.write_text(
        "{\n"
        f'  "updated": "{datetime.date.today().isoformat()}",\n'
        f'  "sources": "Cricsheet (cricsheet.org, ODC-By 1.0) and English Wikipedia, built by scripts/game/build_players.py",\n'
        '  "players": [\n' + lines + "\n  ]\n}\n"
    )
    print(f"Wrote {len(players)} players, {len(answer_ids)} of them answers, to {OUT.relative_to(ROOT)}")
    print(f"By country: {dict(Counter(p['country'] for p in players).most_common())}")
    if problems:
        print(f"\n{len(problems)} notes:")
        for name, note in problems:
            print(f"  {name}: {note}")

    if args.schedule:
        write_schedule(args.schedule, answers, {p["id"]: p for p in players})


def write_schedule(start, answers, players):
    """Two shuffled passes through the answers, with no country two days running."""
    datetime.date.fromisoformat(start)
    order = []
    for cycle in range(2):
        rng = random.Random(f"mystery-cricketer-{start}-{cycle}")
        batch = sorted(answers)
        rng.shuffle(batch)
        for i in range(len(batch)):
            previous = order[-1] if order else None
            if previous and players[batch[i]]["country"] == players[previous]["country"]:
                for j in range(i + 1, len(batch)):
                    if players[batch[j]]["country"] != players[previous]["country"]:
                        batch[i], batch[j] = batch[j], batch[i]
                        break
            order.append(batch[i])
    SCHEDULE.write_text(json.dumps({"start": start, "answers": order}, indent=2) + "\n")
    print(f"Wrote a {len(order)}-day schedule from {start} to {SCHEDULE.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--offline", action="store_true", help="reuse the last download instead of fetching again")
    parser.add_argument("--schedule", metavar="YYYY-MM-DD", help="also write a new schedule whose puzzle 1 is this date")
    build(parser.parse_args())
