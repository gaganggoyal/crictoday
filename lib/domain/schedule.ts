import { INDIA_STATES, indiaState, stateOfCity } from "@/lib/data/india";
import { slugify } from "@/lib/domain/slug";

/**
 * Reads a club's match schedule from spreadsheet rows: a CSV or .xlsx file, or cells pasted from
 * Excel or Google Sheets. Runs in the browser for the preview and on the server, which checks
 * every row again before saving.
 */

/** A file that cannot be read as a schedule, with a message for the person who chose it. */
export class SheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetError";
  }
}

export const MAX_IMPORT_ROWS = 200;
/** What the server takes in one request, blank rows and extra columns included. */
export const MAX_SHEET_ROWS = 1000;
export const MAX_SHEET_COLUMNS = 30;
export const MAX_SHEET_CELL = 500;

export type ScheduleField =
  | "date"
  | "time"
  | "match"
  | "homeTeam"
  | "awayTeam"
  | "ground"
  | "city"
  | "state"
  | "competition"
  | "format"
  | "attendance"
  | "entryNotes"
  | "ticketUrl"
  | "status";

export const SCHEDULE_FIELD_LABEL: Record<ScheduleField, string> = {
  date: "Date",
  time: "Start time",
  match: "Match",
  homeTeam: "Home side",
  awayTeam: "Away side",
  ground: "Ground",
  city: "Town",
  state: "State",
  competition: "Tournament",
  format: "Format",
  attendance: "Entry",
  entryNotes: "Entry notes",
  ticketUrl: "Ticket link",
  status: "Status",
};

/** The template's columns, and the order rows without a header row are read in. */
export const TEMPLATE_FIELDS: ScheduleField[] = [
  "date",
  "time",
  "homeTeam",
  "awayTeam",
  "ground",
  "city",
  "competition",
  "format",
  "attendance",
  "entryNotes",
  "ticketUrl",
];

/** Header names people use, lower-cased with spaces and punctuation removed. */
const HEADERS: Record<ScheduleField, string[]> = {
  date: ["date", "matchdate", "dateofmatch", "fixturedate", "playingdate", "day", "dated", "when"],
  time: [
    "time",
    "starttime",
    "start",
    "matchtime",
    "startingtime",
    "timeist",
    "starttimeist",
    "kickoff",
    "begins",
  ],
  match: ["match", "fixture", "fixtures", "teams", "game", "matchup"],
  homeTeam: [
    "home",
    "hometeam",
    "homeside",
    "homeclub",
    "team1",
    "teama",
    "side1",
    "host",
    "hosts",
  ],
  awayTeam: [
    "away",
    "awayteam",
    "awayside",
    "awayclub",
    "team2",
    "teamb",
    "side2",
    "opponent",
    "opponents",
    "opposition",
    "versus",
    "vs",
    "visitors",
  ],
  ground: [
    "ground",
    "venue",
    "groundname",
    "venuename",
    "groundvenue",
    "venueground",
    "stadium",
    "field",
    "pitch",
    "location",
    "place",
  ],
  city: ["town", "city", "towncity", "citytown", "townorcity", "cityortown", "district"],
  state: ["state", "stateut", "stateorut", "region", "province"],
  competition: [
    "tournament",
    "competition",
    "series",
    "league",
    "event",
    "cup",
    "trophy",
    "tournamentname",
    "competitionname",
  ],
  format: ["format", "matchformat", "matchtype", "type", "overs"],
  attendance: [
    "entry",
    "entrytype",
    "attendance",
    "admission",
    "access",
    "publicentry",
    "spectators",
  ],
  entryNotes: [
    "entrynotes",
    "notes",
    "note",
    "remarks",
    "comments",
    "details",
    "info",
    "information",
  ],
  ticketUrl: [
    "ticketlink",
    "ticketurl",
    "tickets",
    "ticket",
    "bookinglink",
    "bookingurl",
    "link",
    "url",
  ],
  status: ["status", "matchstatus"],
};

const HEADER_FIELD = new Map<string, ScheduleField>(
  Object.entries(HEADERS).flatMap(([field, names]) =>
    names.map((name) => [name, field as ScheduleField] as const),
  ),
);

export function headerField(cell: string): ScheduleField | null {
  const key = cell
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "");
  return HEADER_FIELD.get(key) ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (value: number) => String(value).padStart(2, "0");

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  if (date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const fullYear = (value: string) => (value.length <= 2 ? 2000 + Number(value) : Number(value));

/** A date written without its year is the next one, counting from a month ago. */
function inferYear(month: number, day: number, now: Date) {
  const year = now.getUTCFullYear();
  return Date.UTC(year, month - 1, day) < now.getTime() - 30 * DAY_MS ? year + 1 : year;
}

/** Excel keeps a time of day as a fraction of a day. */
function fractionTime(fraction: number) {
  const minutes = Math.round(fraction * 24 * 60) % (24 * 60);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Reads 9:30, 9.30 am, 9:30PM, 2 pm, 0930, 14:00, noon, and Excel's day fractions. */
export function readTime(raw: string): string | null {
  const text = raw
    .toLowerCase()
    .replace(/a\.\s?m\.?/g, "am")
    .replace(/p\.\s?m\.?/g, "pm")
    .replace(/\b(?:ist|hrs|hours|hr|local|onwards|sharp|approx)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (/^(?:12 ?)?noon$/.test(text)) return "12:00";
  if (/^0?\.\d+$/.test(text)) return fractionTime(Number(text));
  const match =
    /^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm)?$/.exec(text) ??
    /^(\d{1,2})(\d{2})\s*(am|pm)?$/.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const half = match[3];
  if (minute > 59) return null;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    if (half === "pm" && hour !== 12) hour += 12;
    if (half === "am" && hour === 12) hour = 0;
  } else if (hour >= 1 && hour <= 5) {
    // Matches do not start between 1 and 5 in the morning, so "2:30" means the afternoon.
    hour += 12;
  }
  return hour > 23 ? null : `${pad(hour)}:${pad(minute)}`;
}

const TIME_TAIL =
  /^(.*?)(?:\s+at\s+|\s+|t)(\d{1,2}(?:[:.]\d{2}){1,2}\s*(?:am|pm|a\.m\.|p\.m\.)?|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))$/;

/**
 * Reads a date, day first as in India: 01/11/2026, 1-11-26, 1.11.2026, 2026-11-01, 1 Nov 2026,
 * Sunday 1st November, Nov 1, and the numbers Excel stores dates as. A time after the date is
 * returned too.
 */
export function readDate(
  raw: string,
  now: Date,
  date1904 = false,
): { date: string; time: string | null } | null {
  let text = raw.trim().toLowerCase();
  if (!text) return null;
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial < 20000 || serial >= 80000) return null;
    const days = Math.floor(serial);
    const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    const fraction = serial - days;
    return {
      date: new Date(base + days * DAY_MS).toISOString().slice(0, 10),
      time: fraction > 0.0001 ? fractionTime(fraction) : null,
    };
  }
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) {
    const date = isoDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
    return date ? { date, time: null } : null;
  }
  text = text
    .replace(
      /\b(?:mon|tues?|wed|thu|thurs?|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?\b\.?/g,
      " ",
    )
    .replace(/(\d)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let time: string | null = null;
  const tail = TIME_TAIL.exec(text);
  if (tail) {
    const read = readTime(tail[2]!);
    if (read) {
      time = read;
      text = tail[1]!.trim();
    }
  }
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) {
    const date = isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    return date ? { date, time } : null;
  }
  match = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{4}|\d{2}))?$/.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    // Day first, unless that cannot be a date and month first can, as in 11/23/2026.
    const [day, month] = second > 12 && first <= 12 ? [second, first] : [first, second];
    const year = match[3] ? fullYear(match[3]) : inferYear(month, day, now);
    const date = isoDate(year, month, day);
    return date ? { date, time } : null;
  }
  match = /^(\d{1,2})[ -]?([a-z]+)\.?(?:[ -](\d{4}|\d{2}))?$/.exec(text);
  const named = match && MONTHS[match[2]!] ? match : null;
  const monthFirst = named ? null : /^([a-z]+)\.?[ -]?(\d{1,2})(?:[ -](\d{4}|\d{2}))?$/.exec(text);
  if (named || (monthFirst && MONTHS[monthFirst[1]!])) {
    const day = Number(named ? named[1] : monthFirst![2]);
    const month = MONTHS[named ? named[2]! : monthFirst![1]!]!;
    const written = named ? named[3] : monthFirst![3];
    const year = written ? fullYear(written) : inferYear(month, day, now);
    const date = isoDate(year, month, day);
    return date ? { date, time } : null;
  }
  return null;
}

export type ScheduleFormat = "t20" | "odi" | "t10" | "test" | "other";

/** T20, 20 overs, ODI, 50 overs, one-day, T10, two-day, Test; anything else is "other". */
export function readFormat(raw: string): ScheduleFormat {
  const text = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (/\bt ?20\b|\btwenty ?20\b|\b20 20\b|\b20 ?overs?\b/.test(text)) return "t20";
  if (/\bt ?10\b|\b10 ?overs?\b/.test(text)) return "t10";
  if (/\bodi\b|\bone ?day\b|\bod\b|\blist a\b|\b(?:35|40|45|50) ?overs?\b/.test(text)) return "odi";
  if (
    /\btest\b|\bmulti ?day\b|\bfirst class\b|\b(?:two|three|four|five|[2-5]) ?days?\b/.test(text)
  ) {
    return "test";
  }
  return "other";
}

/** Free, tickets or private, from words like "Free entry", "₹100", "Members only". */
export function readEntry(raw: string): "free" | "ticketed" | "private" | null {
  const text = raw.toLowerCase().trim();
  if (/private|invit|closed|members? only|no spectators|not open/.test(text)) return "private";
  if (/\bfree\b|\bopen\b|no ticket|no charge|all welcome|everyone/.test(text)) return "free";
  if (/ticket|paid|\bpay|₹|\brs\b|\binr\b|[$£€]|\d/.test(text)) return "ticketed";
  return null;
}

export function readStatus(raw: string): "published" | "postponed" | "cancelled" | null {
  const text = raw.toLowerCase().trim();
  if (
    !text ||
    /^(?:on|on as planned|as planned|scheduled|confirmed|planned|yes|ok|live)$/.test(text)
  ) {
    return "published";
  }
  if (/cancel|called off|abandon|scrapped|washed out/.test(text)) return "cancelled";
  if (/postpon|reschedul|delayed/.test(text)) return "postponed";
  return null;
}

/** "Dadar Strikers vs Matunga Lions", "A v B", "A versus B" or "A - B". */
export function splitTeams(raw: string): [string, string] | null {
  for (const separator of [/\s+(?:vs?\.?|versus|v\/s)\s+/i, /\s+[-–—]\s+/]) {
    const parts = raw.split(separator).map((part) => part.trim());
    if (parts.length === 2 && parts[0] && parts[1]) return [parts[0], parts[1]];
  }
  return null;
}

/** Vehicle-registration codes, which most Indians know for their state. */
const STATE_CODES: Record<string, string> = {
  ap: "andhra-pradesh",
  ar: "arunachal-pradesh",
  as: "assam",
  br: "bihar",
  cg: "chhattisgarh",
  ga: "goa",
  gj: "gujarat",
  hr: "haryana",
  hp: "himachal-pradesh",
  jh: "jharkhand",
  ka: "karnataka",
  kl: "kerala",
  mp: "madhya-pradesh",
  mh: "maharashtra",
  od: "odisha",
  or: "odisha",
  pb: "punjab",
  rj: "rajasthan",
  tn: "tamil-nadu",
  ts: "telangana",
  tg: "telangana",
  up: "uttar-pradesh",
  uk: "uttarakhand",
  wb: "west-bengal",
  ch: "chandigarh",
  dl: "delhi",
  jk: "jammu-and-kashmir",
  py: "puducherry",
};

export function readState(raw: string) {
  const key = slugify(raw);
  if (!key) return null;
  return (
    indiaState(STATE_CODES[key] ?? key) ??
    INDIA_STATES.find((state) => slugify(state.name) === key) ??
    null
  );
}

export type ScheduleValues = {
  competition: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  ground: string;
  state: string;
  city: string;
  format: ScheduleFormat;
  attendance: string;
  entryNotes: string;
  ticketUrl: string;
  status: string;
};

export type ScheduleItem = {
  /** The row number the spreadsheet shows. */
  line: number;
  values: ScheduleValues;
  problems: string[];
  /** Fields the sheet left empty that were taken from the profile. */
  filled: Array<"homeTeam" | "ground" | "city">;
};

export type ScheduleColumn = { name: string; field: ScheduleField | null };

export type ScheduleContext = {
  now: Date;
  date1904?: boolean;
  defaults: {
    /** The profile's own name, for sheets that list only the opponent. */
    homeTeam: string | null;
    ground: string;
    city: string;
    stateSlug: string | null;
    india: boolean;
  };
};

/** The header row, if one of the first rows names a date column and the sides. */
function findHeader(rows: string[][]) {
  for (let index = 0; index < Math.min(rows.length, 6); index += 1) {
    const fields = (rows[index] ?? []).map(headerField);
    const known = new Set(fields);
    const sides = known.has("match") || known.has("homeTeam") || known.has("awayTeam");
    if (known.has("date") && sides) return { index, fields };
  }
  return null;
}

export function readSchedule(rows: string[][], context: ScheduleContext) {
  const header = findHeader(rows);
  const fields: Array<ScheduleField | null> = header ? header.fields : TEMPLATE_FIELDS;
  const columns: ScheduleColumn[] = header
    ? header.fields
        .map((field, index) => ({ name: (rows[header.index]![index] ?? "").trim(), field }))
        .filter((column) => column.name)
    : TEMPLATE_FIELDS.map((field) => ({ name: SCHEDULE_FIELD_LABEL[field], field }));
  const items: ScheduleItem[] = [];

  for (let index = header ? header.index + 1 : 0; index < rows.length; index += 1) {
    const row = (rows[index] ?? []).map((cell) => cell.replace(/\s+/g, " ").trim());
    if (!row.some(Boolean)) continue;
    const cells = (field: ScheduleField) =>
      fields.flatMap((name, at) => (name === field && row[at] ? [row[at]!] : []));
    const pick = (field: ScheduleField) => cells(field)[0] ?? "";
    const problems: string[] = [];
    const filled: ScheduleItem["filled"] = [];

    let homeTeam = pick("homeTeam");
    let awayTeam = pick("awayTeam");
    const fixture = pick("match");
    if (fixture && (!homeTeam || !awayTeam)) {
      const sides = splitTeams(fixture);
      if (sides) [homeTeam, awayTeam] = [homeTeam || sides[0], awayTeam || sides[1]];
      else
        problems.push(
          `Could not find two sides in "${fixture}". Write it as Home side vs Away side.`,
        );
    }
    if (!homeTeam && awayTeam && context.defaults.homeTeam) {
      homeTeam = context.defaults.homeTeam;
      filled.push("homeTeam");
    }
    if (!homeTeam && !fixture) problems.push("The home side is missing.");
    if (!awayTeam && !fixture) problems.push("The away side is missing.");

    const dateCell = pick("date");
    const when = dateCell ? readDate(dateCell, context.now, context.date1904) : null;
    if (!dateCell) problems.push("The date is missing.");
    else if (!when)
      problems.push(`Could not read the date "${dateCell}". Write it like 01/11/2026.`);
    const timeCell = pick("time");
    const time = timeCell ? readTime(timeCell) : (when?.time ?? null);
    if (timeCell && !time) {
      problems.push(`Could not read the time "${timeCell}". Write it like 9:30 am or 14:00.`);
    } else if (!time && when) {
      problems.push("The start time is missing.");
    }

    let ground = pick("ground");
    if (!ground && context.defaults.ground) {
      ground = context.defaults.ground;
      filled.push("ground");
    }
    let city = pick("city");
    if (!city && context.defaults.city) {
      city = context.defaults.city;
      filled.push("city");
    }
    let state = "";
    if (context.defaults.india) {
      const stateCell = pick("state");
      const named = stateCell ? readState(stateCell) : null;
      if (stateCell && !named) {
        problems.push(`"${stateCell}" is not an Indian state or union territory.`);
      }
      state = named?.slug ?? stateOfCity(slugify(city))?.slug ?? context.defaults.stateSlug ?? "";
    }

    const notes = cells("entryNotes");
    let ticketUrl = "";
    const ticketCell = pick("ticketUrl");
    if (/^https?:\/\//i.test(ticketCell)) ticketUrl = ticketCell;
    else if (/^www\./i.test(ticketCell)) ticketUrl = `https://${ticketCell}`;
    else if (ticketCell) notes.push(ticketCell);
    const entryCell = pick("attendance");
    const attendance = entryCell ? readEntry(entryCell) : ticketUrl ? "ticketed" : "free";
    if (!attendance) {
      problems.push(
        `Could not tell how people get in from "${entryCell}". Write free, tickets or private.`,
      );
    } else if (attendance === "ticketed" && /\d/.test(entryCell)) {
      // A price written in the entry column belongs in the notes.
      notes.unshift(entryCell);
    }
    const entryNotes = notes.join("; ");
    if (entryNotes.length > 300) problems.push("The entry notes are longer than 300 characters.");

    const statusCell = pick("status");
    const status = readStatus(statusCell);
    if (!status) {
      problems.push(`Could not read the status "${statusCell}". Write on, postponed or cancelled.`);
    }

    items.push({
      line: index + 1,
      values: {
        competition: pick("competition"),
        homeTeam,
        awayTeam,
        date: when?.date ?? "",
        time: time ?? "",
        ground,
        state,
        city,
        format: readFormat(pick("format")),
        attendance: attendance ?? "",
        entryNotes,
        ticketUrl,
        status: status ?? "published",
      },
      problems,
      filled,
    });
  }
  return { columns, items, hasStatus: fields.includes("status") };
}

/** Splits CSV or tab-separated text, as saved by Excel or copied from Google Sheets. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const delimiter = first.includes("\t")
    ? "\t"
    : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let at = 0; at < clean.length; at += 1) {
    const character = clean[at]!;
    if (quoted) {
      if (character !== '"') cell += character;
      else if (clean[at + 1] === '"') {
        cell += '"';
        at += 1;
      } else quoted = false;
    } else if (character === '"' && !cell.trim()) {
      quoted = true;
      cell = "";
    } else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && clean[at + 1] === "\n") at += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Text from a CSV file in whatever encoding Excel saved it: UTF-8, UTF-16 or Windows-1252. */
export function decodeSheetText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Mapped by hand: some TextDecoder builds read windows-1252 as Latin-1 and lose €, curly
    // quotes and dashes.
    return Array.from(bytes, (byte) =>
      byte >= 0x80 && byte <= 0x9f ? WINDOWS_1252[byte - 0x80] : String.fromCharCode(byte),
    ).join("");
  }
}

/** Windows-1252's characters for bytes 0x80 to 0x9F; the rest match Latin-1. */
const WINDOWS_1252 =
  "\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f" +
  "\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178";

/** Cuts rows down to what the server takes, keeping row numbers. */
export function fitSheet(rows: string[][]) {
  let last = rows.length;
  while (last > 0 && !(rows[last - 1] ?? []).some((cell) => cell.trim())) last -= 1;
  return rows
    .slice(0, Math.min(last, MAX_SHEET_ROWS))
    .map((row) => row.slice(0, MAX_SHEET_COLUMNS).map((cell) => cell.slice(0, MAX_SHEET_CELL)));
}
