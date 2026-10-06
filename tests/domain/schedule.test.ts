import { describe, expect, it } from "vitest";
import {
  MAX_SHEET_COLUMNS,
  decodeSheetText,
  fitSheet,
  parseDelimited,
  readDate,
  readEntry,
  readFormat,
  readSchedule,
  readState,
  readStatus,
  readTime,
  splitTeams,
  type ScheduleContext,
} from "@/lib/domain/schedule";

const now = new Date("2026-10-06T06:00:00.000Z");

const context: ScheduleContext = {
  now,
  defaults: {
    homeTeam: "Shivaji Park Gymkhana",
    ground: "Shivaji Park",
    city: "Mumbai",
    stateSlug: "maharashtra",
    india: true,
  },
};

describe("reading dates", () => {
  it.each([
    ["01/11/2026", "2026-11-01"],
    ["1-11-26", "2026-11-01"],
    ["1.11.2026", "2026-11-01"],
    ["2026-11-01", "2026-11-01"],
    ["1 Nov 2026", "2026-11-01"],
    ["01-Nov-26", "2026-11-01"],
    ["Sunday, 1st November 2026", "2026-11-01"],
    ["Nov 1, 2026", "2026-11-01"],
    ["november 1 2026", "2026-11-01"],
    ["20261101", "2026-11-01"],
    ["46327", "2026-11-01"],
  ])("reads %s day first", (raw, date) => {
    expect(readDate(raw, now)).toEqual({ date, time: null });
  });

  it("reads month first only when day first cannot be a date", () => {
    expect(readDate("11/23/2026", now)?.date).toBe("2026-11-23");
    expect(readDate("05/11/2026", now)?.date).toBe("2026-11-05");
  });

  it("refuses dates that do not exist", () => {
    for (const raw of ["31/02/2026", "13/13/2026", "next Sunday", "TBC", "123"]) {
      expect(readDate(raw, now)).toBeNull();
    }
  });

  it("takes a time written after the date, and Excel's time fractions", () => {
    expect(readDate("01/11/2026 9:30 am", now)).toEqual({ date: "2026-11-01", time: "09:30" });
    expect(readDate("Sun 1 Nov at 2 pm", now)).toEqual({ date: "2026-11-01", time: "14:00" });
    expect(readDate("2026-11-01T14:00:00", now)).toEqual({ date: "2026-11-01", time: "14:00" });
    expect(readDate("46327.395833333336", now)).toEqual({ date: "2026-11-01", time: "09:30" });
    expect(readDate("44865", now, true)).toEqual({ date: "2026-11-01", time: null });
  });

  it("gives a date without a year the coming one", () => {
    expect(readDate("1 Nov", now)?.date).toBe("2026-11-01");
    // Three weeks ago is this year's, and shows as already played.
    expect(readDate("15/09", now)?.date).toBe("2026-09-15");
    expect(readDate("1 Aug", now)?.date).toBe("2027-08-01");
  });
});

describe("reading times", () => {
  it.each([
    ["9:30", "09:30"],
    ["9.30 am", "09:30"],
    ["9:30AM", "09:30"],
    ["9:30 a.m.", "09:30"],
    ["2 pm", "14:00"],
    ["12:30 pm", "12:30"],
    ["12 noon", "12:00"],
    ["0930", "09:30"],
    ["14:00", "14:00"],
    ["14:00:00", "14:00"],
    ["18:30 IST", "18:30"],
    ["0.3958333333333333", "09:30"],
    ["6:30", "06:30"],
  ])("reads %s", (raw, time) => {
    expect(readTime(raw)).toBe(time);
  });

  it("reads 1 to 5 without am or pm as the afternoon", () => {
    expect(readTime("2:30")).toBe("14:30");
    expect(readTime("3")).toBe("15:00");
  });

  it("refuses times that cannot be", () => {
    for (const raw of ["25:00", "9:75", "13 pm", "evening", ""]) expect(readTime(raw)).toBeNull();
  });
});

describe("reading the other columns", () => {
  it("reads formats in local words", () => {
    expect(["T20", "t-20", "20 overs", "Twenty20"].map(readFormat)).toEqual([
      "t20",
      "t20",
      "t20",
      "t20",
    ]);
    expect(["ODI", "One Day", "50-over", "40 overs"].map(readFormat)).toEqual([
      "odi",
      "odi",
      "odi",
      "odi",
    ]);
    expect(["T10", "10 overs"].map(readFormat)).toEqual(["t10", "t10"]);
    expect(["Two-day", "3 day", "Test", "Multi-day"].map(readFormat)).toEqual([
      "test",
      "test",
      "test",
      "test",
    ]);
    expect(["Box cricket", "Tennis ball 8 overs", ""].map(readFormat)).toEqual([
      "other",
      "other",
      "other",
    ]);
  });

  it("reads how people get in", () => {
    expect(readEntry("Free entry")).toBe("free");
    expect(readEntry("Open to all")).toBe("free");
    expect(readEntry("₹100 at the gate")).toBe("ticketed");
    expect(readEntry("Tickets")).toBe("ticketed");
    expect(readEntry("Members only")).toBe("private");
    expect(readEntry("Not open to the public")).toBe("private");
    expect(readEntry("maybe")).toBeNull();
  });

  it("reads statuses", () => {
    expect(["", "On", "Confirmed"].map(readStatus)).toEqual([
      "published",
      "published",
      "published",
    ]);
    expect(readStatus("Called off")).toBe("cancelled");
    expect(readStatus("Rescheduled")).toBe("postponed");
    expect(readStatus("Rain?")).toBeNull();
  });

  it("splits a match column into its sides", () => {
    expect(splitTeams("Dadar Strikers vs Matunga Lions")).toEqual([
      "Dadar Strikers",
      "Matunga Lions",
    ]);
    expect(splitTeams("Dadar Strikers v. Matunga Lions")).toEqual([
      "Dadar Strikers",
      "Matunga Lions",
    ]);
    expect(splitTeams("Dadar Strikers - Matunga Lions")).toEqual([
      "Dadar Strikers",
      "Matunga Lions",
    ]);
    expect(splitTeams("Dadar Strikers")).toBeNull();
  });

  it("reads Indian states by name or code", () => {
    expect(readState("MH")?.slug).toBe("maharashtra");
    expect(readState("tn")?.slug).toBe("tamil-nadu");
    expect(readState("Tamil Nadu")?.slug).toBe("tamil-nadu");
    expect(readState("Jammu and Kashmir")?.slug).toBe("jammu-and-kashmir");
    expect(readState("Narnia")).toBeNull();
    for (const code of ["ap", "dl", "wb", "up", "uk", "ts", "od", "jk", "py", "ch", "cg", "hp"]) {
      expect(readState(code), code).not.toBeNull();
    }
  });
});

describe("reading spreadsheet text", () => {
  it("splits CSV with quotes, commas and line breaks inside cells", () => {
    const csv =
      'Date,Ground,Notes\r\n01/11/2026,"Shivaji Park, Dadar","Gate 2, ""north"" side\nfree"\r\n\r\n';
    expect(parseDelimited(csv)).toEqual([
      ["Date", "Ground", "Notes"],
      ["01/11/2026", "Shivaji Park, Dadar", 'Gate 2, "north" side\nfree'],
      [""],
    ]);
  });

  it("splits rows pasted from a spreadsheet, and semicolon CSV", () => {
    expect(parseDelimited("Date\tGround\n01/11/2026\tShivaji Park, Dadar\n")).toEqual([
      ["Date", "Ground"],
      ["01/11/2026", "Shivaji Park, Dadar"],
    ]);
    expect(parseDelimited("Date;Ground;Town\n01/11/2026;Oval, East;Pune")).toEqual([
      ["Date", "Ground", "Town"],
      ["01/11/2026", "Oval, East", "Pune"],
    ]);
  });

  it("decodes UTF-8, Excel's UTF-16 and old Windows CSV files", () => {
    const utf8 = new TextEncoder().encode("﻿Entry\n₹100");
    expect(decodeSheetText(utf8.buffer as ArrayBuffer)).toBe("Entry\n₹100");
    const utf16 = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xb9, 0x20]);
    expect(decodeSheetText(utf16.buffer)).toBe("A₹");
    const windows = new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80]);
    expect(decodeSheetText(windows.buffer)).toBe("Café €");
    const quotes = new Uint8Array([0x93, 0x47, 0x61, 0x74, 0x65, 0x94, 0x20, 0x96, 0x20, 0x32]);
    expect(decodeSheetText(quotes.buffer)).toBe("\u201cGate\u201d \u2013 2");
  });

  it("drops trailing blank rows and trims what the server would refuse", () => {
    const rows = [["a", "b"], [], ["c"], [], [""]];
    expect(fitSheet(rows)).toEqual([["a", "b"], [], ["c"]]);
    const wide = [Array.from({ length: 40 }, () => "x".repeat(600))];
    const [row] = fitSheet(wide);
    expect(row).toHaveLength(MAX_SHEET_COLUMNS);
    expect(row![0]).toHaveLength(500);
  });
});

describe("reading a schedule", () => {
  it("finds the header under a title row and reads columns by their names", () => {
    const sheet = readSchedule(
      [
        ["Diwali Cup 2026"],
        [],
        ["Match Date", "Time (IST)", "Fixture", "Venue", "City", "Entry", "Remarks", "Captain"],
        [
          "Sun 1 Nov 2026",
          "9.30 am",
          "Dadar Strikers vs Matunga Lions",
          "",
          "",
          "Free",
          "",
          "R. Shah",
        ],
        [
          "08/11/2026",
          "2 pm",
          "Matunga Lions v Pune Panthers",
          "Nehru Stadium",
          "Pune",
          "₹50",
          "Gate 2",
          "",
        ],
      ],
      context,
    );
    expect(sheet.columns.map((column) => column.field)).toEqual([
      "date",
      "time",
      "match",
      "ground",
      "city",
      "attendance",
      "entryNotes",
      null,
    ]);
    expect(sheet.items.map((item) => item.line)).toEqual([4, 5]);
    expect(sheet.items[0]).toMatchObject({
      values: {
        homeTeam: "Dadar Strikers",
        awayTeam: "Matunga Lions",
        date: "2026-11-01",
        time: "09:30",
        ground: "Shivaji Park",
        city: "Mumbai",
        state: "maharashtra",
        attendance: "free",
        format: "other",
        status: "published",
      },
      problems: [],
      filled: ["ground", "city"],
    });
    expect(sheet.items[1]?.values).toMatchObject({
      city: "Pune",
      state: "maharashtra",
      attendance: "ticketed",
      entryNotes: "₹50; Gate 2",
      time: "14:00",
    });
    expect(sheet.hasStatus).toBe(false);
  });

  it("puts the club in as the home side when the sheet lists opponents", () => {
    const sheet = readSchedule(
      [
        ["Date", "Opponent", "Ground", "Town", "State", "Tickets", "Status"],
        [
          "15/11/2026 10:00",
          "Chennai Kings",
          "Chepauk B",
          "Chennai",
          "TN",
          "www.tickets.example.com/x",
          "Postponed",
        ],
      ],
      context,
    );
    expect(sheet.items[0]).toMatchObject({
      values: {
        homeTeam: "Shivaji Park Gymkhana",
        awayTeam: "Chennai Kings",
        time: "10:00",
        state: "tamil-nadu",
        attendance: "ticketed",
        ticketUrl: "https://www.tickets.example.com/x",
        status: "postponed",
      },
      filled: ["homeTeam"],
    });
    expect(sheet.hasStatus).toBe(true);
  });

  it("reads rows without a header in the template's order, and says what is wrong", () => {
    const sheet = readSchedule(
      [
        [
          "01/11/2026",
          "9:30",
          "Dadar Strikers",
          "Matunga Lions",
          "Shivaji Park",
          "Mumbai",
          "Diwali Cup",
          "T20",
          "Free",
          "",
          "",
        ],
        ["32/11/2026", "evening", "Dadar Strikers", "", "", "", "", "", "Maybe", "", "Pay at gate"],
        ["01/12/2026", "", "Dadar Strikers", "Matunga Lions", "", "", "", "", "", "", ""],
      ],
      { ...context, defaults: { ...context.defaults, homeTeam: null } },
    );
    expect(sheet.items[0]?.values).toMatchObject({
      competition: "Diwali Cup",
      format: "t20",
      date: "2026-11-01",
    });
    expect(sheet.items[1]?.problems).toEqual([
      "The away side is missing.",
      'Could not read the date "32/11/2026". Write it like 01/11/2026.',
      'Could not read the time "evening". Write it like 9:30 am or 14:00.',
      'Could not tell how people get in from "Maybe". Write free, tickets or private.',
    ]);
    expect(sheet.items[1]?.values.entryNotes).toBe("Pay at gate");
    expect(sheet.items[2]?.problems).toEqual(["The start time is missing."]);
  });

  it("asks for a state it does not know", () => {
    const sheet = readSchedule(
      [
        ["Date", "Time", "Home", "Away", "State"],
        ["01/11/2026", "9:30", "A XI", "B XI", "Narnia"],
      ],
      context,
    );
    expect(sheet.items[0]?.problems).toEqual([
      '"Narnia" is not an Indian state or union territory.',
    ]);
  });
});
