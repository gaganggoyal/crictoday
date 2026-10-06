import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SheetError, readSchedule } from "@/lib/domain/schedule";
import { readXlsx } from "@/lib/sheets/xlsx";

// Workbooks written by openpyxl, then reshaped as Excel and other tools save them. See
// tests/fixtures/make-xlsx.py.
async function fixture(name: string) {
  const data = await readFile(path.join(import.meta.dirname, "..", "fixtures", name));
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

const header = ["Date", "Start time", "Match", "Venue", "Town", "Entry", "Notes", "Confirmed"];
const expected = (notes: string, dates = ["46327", "46334.58333333334"]) => [
  ["Diwali Cup 2026 – fixtures & venues"],
  [],
  header,
  [
    dates[0],
    "0.3958333333333333",
    "Dadar Strikers vs Matunga Lions",
    "Shivaji Park",
    "Mumbai",
    "Free",
    notes,
    "TRUE",
  ],
  [
    dates[1],
    "",
    "Matunga Lions vs Pune Panthers",
    "Nehru Stadium",
    "Pune",
    "₹50 at the gate",
    "",
    "FALSE",
  ],
  [
    "15/11/2026",
    "4:00 PM",
    "Thane Tigers vs Dadar Strikers",
    "Dadoji Konddev",
    "Thane",
    "Free",
    "",
  ],
  [],
  ["Last row after a gap"],
];

describe("reading .xlsx files", () => {
  it("reads the first sheet's cells, gaps and all, with inline text", async () => {
    const sheet = await readXlsx(await fixture("schedule.xlsx"));
    expect(sheet).toEqual({ rows: expected("Gate 2 <north> & east"), date1904: false });
  });

  it("reads Excel's shared strings, prefixed elements and stored parts", async () => {
    const excel = await readXlsx(await fixture("schedule-excel.xlsx"));
    expect(excel.rows).toEqual(expected("Gate 2\r<north> & east"));
    const stored = await readXlsx(await fixture("schedule-stored.xlsx"));
    expect(stored.rows).toEqual(expected("Gate 2 <north> & east"));
  });

  it("knows a workbook that counts dates from 1904", async () => {
    const sheet = await readXlsx(await fixture("schedule-1904.xlsx"));
    expect(sheet.date1904).toBe(true);
    expect(sheet.rows[3]?.[0]).toBe("44865");
  });

  it("turns the cells into matches, Excel dates and times included", async () => {
    for (const [name, date1904] of [
      ["schedule.xlsx", false],
      ["schedule-1904.xlsx", true],
    ] as const) {
      const { rows } = await readXlsx(await fixture(name));
      const sheet = readSchedule(rows, {
        now: new Date("2026-10-06T06:00:00.000Z"),
        date1904,
        defaults: { homeTeam: null, ground: "", city: "", stateSlug: null, india: true },
      });
      expect(
        sheet.items.map((item) => [
          item.line,
          item.values.date,
          item.values.time,
          item.values.awayTeam,
        ]),
      ).toEqual([
        [4, "2026-11-01", "09:30", "Matunga Lions"],
        [5, "2026-11-08", "14:00", "Pune Panthers"],
        [6, "2026-11-15", "16:00", "Dadar Strikers"],
        [8, "", "", ""],
      ]);
      expect(sheet.items[1]?.values).toMatchObject({
        attendance: "ticketed",
        state: "maharashtra",
      });
      expect(sheet.items[3]?.problems).toHaveLength(3);
    }
  });

  it("refuses files that are not workbooks, or that inflate past the limit", async () => {
    await expect(
      readXlsx(new TextEncoder().encode("Date,Time\n").buffer as ArrayBuffer),
    ).rejects.toThrow(SheetError);
    const whole = await fixture("schedule.xlsx");
    await expect(readXlsx(whole.slice(0, 3000))).rejects.toThrow(SheetError);
    await expect(readXlsx(await fixture("schedule-bomb.xlsx"))).rejects.toThrow("too large");
  });
});
