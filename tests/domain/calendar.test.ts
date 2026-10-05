import { describe, expect, it } from "vitest";
import { escapeIcsText, foldIcsLine, matchCalendar } from "@/lib/domain/calendar";
import type { StoredMatch } from "@/lib/domain/types";
import { matches } from "@/lib/data/seed";

const now = new Date("2026-10-04T12:00:00.000Z");
const site = "https://cricketmatch.today";
const encoder = new TextEncoder();

function seed(slug: string): StoredMatch {
  const match = matches.find((item) => item.slug === slug);
  if (!match) throw new Error(`Missing seed match ${slug}`);
  return match;
}

function unfold(body: string) {
  return body.replace(/\r\n /g, "");
}

describe("calendar export", () => {
  it("escapes text values", () => {
    expect(escapeIcsText("Lord's, London; Day 1\\2\nGate C")).toBe(
      "Lord's\\, London\\; Day 1\\\\2\\nGate C",
    );
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    for (const line of [`DESCRIPTION:${"a".repeat(200)}`, `SUMMARY:${"é".repeat(90)}`]) {
      const folded = foldIcsLine(line);
      for (const physical of folded.split("\r\n")) {
        expect(encoder.encode(physical).length).toBeLessThanOrEqual(75);
      }
      expect(unfold(folded)).toBe(line);
    }
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("writes a valid event for a listed match", () => {
    const body = matchCalendar(seed("india-vs-australia-1st-test-ahmedabad-2026-10-16"), site, now);
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body).not.toMatch(/[^\r]\n/);
    for (const line of body.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const lines = unfold(body).split("\r\n");
    expect(lines).toContain("DTSTART:20261016T040000Z");
    expect(lines).toContain("DURATION:PT8H");
    expect(lines).toContain("LOCATION:Narendra Modi Stadium\\, Ahmedabad");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain(
      "URL:https://cricketmatch.today/match/india-vs-australia-1st-test-ahmedabad-2026-10-16",
    );
  });

  it("uses a known end time and marks cancelled and postponed matches", () => {
    const base = seed("india-vs-australia-1st-test-ahmedabad-2026-10-16");
    const withEnd = matchCalendar({ ...base, endsAt: "2026-10-20T12:00:00.000Z" }, site, now);
    expect(unfold(withEnd)).toContain("DTEND:20261020T120000Z");
    expect(withEnd).not.toContain("DURATION:");

    const backwards = matchCalendar({ ...base, endsAt: "2026-10-01T00:00:00.000Z" }, site, now);
    expect(backwards).toContain("DURATION:PT8H");

    expect(matchCalendar({ ...base, status: "cancelled" }, site, now)).toContain(
      "STATUS:CANCELLED",
    );
    expect(matchCalendar({ ...base, status: "postponed" }, site, now)).toContain(
      "STATUS:TENTATIVE",
    );
  });
});
