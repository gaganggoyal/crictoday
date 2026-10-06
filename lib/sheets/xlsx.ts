/**
 * Reads the cells of the first sheet of an .xlsx file, as Excel, Google Sheets, Numbers and
 * LibreOffice save it. It runs in the browser, so the server never opens an uploaded workbook:
 * it gets the cells as text. Numbers stay as Excel stores them; the schedule reader knows Excel's
 * date numbers.
 */

import { SheetError } from "@/lib/domain/schedule";

const NOT_XLSX = "That is not an .xlsx file. Save the sheet as .xlsx or .csv and try again.";
const DAMAGED = "That .xlsx file could not be read. Save it again, or save it as .csv.";
// The workbook parts a schedule needs are small; this stops a compressed bomb.
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMN = 60;

type Part = { method: number; compressedSize: number; size: number; offset: number };

function zipParts(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The central directory's end record sits in the last 64 KB.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end === -1) throw new SheetError(NOT_XLSX);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const parts = new Map<string, Part>();
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) {
      throw new SheetError(DAMAGED);
    }
    const nameLength = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    parts.set(name, {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return parts;
}

async function inflate(data: Uint8Array) {
  if (typeof DecompressionStream !== "function") {
    throw new SheetError("This browser cannot open .xlsx files. Save the sheet as .csv instead.");
  }
  const stream = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PART_BYTES) {
      await reader.cancel();
      throw new SheetError(
        "That workbook is too large. Keep it to the schedule, or save it as .csv.",
      );
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.byteLength;
  }
  return out;
}

async function readPart(bytes: Uint8Array, part: Part) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (part.offset + 30 > bytes.length || view.getUint32(part.offset, true) !== 0x04034b50) {
    throw new SheetError(DAMAGED);
  }
  if (part.size > MAX_PART_BYTES) {
    throw new SheetError(
      "That workbook is too large. Keep it to the schedule, or save it as .csv.",
    );
  }
  const start =
    part.offset +
    30 +
    view.getUint16(part.offset + 26, true) +
    view.getUint16(part.offset + 28, true);
  const data = bytes.subarray(start, start + part.compressedSize);
  if (part.method === 0) return new TextDecoder().decode(data);
  if (part.method === 8) {
    try {
      return new TextDecoder().decode(await inflate(data));
    } catch (error) {
      if (error instanceof SheetError) throw error;
      throw new SheetError(DAMAGED);
    }
  }
  throw new SheetError(DAMAGED);
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function unescapeXml(text: string) {
  return text
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(lt|gt|amp|quot|apos));/g, (_, decimal, hex, name) =>
      decimal
        ? String.fromCodePoint(Number(decimal))
        : hex
          ? String.fromCodePoint(parseInt(hex, 16))
          : ENTITIES[name]!,
    )
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** The text of a shared or inline string, leaving out phonetic guides. */
function stringText(fragment: string) {
  const body = fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let text = "";
  for (const match of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += match[1];
  return unescapeXml(text);
}

function attribute(tag: string, name: string) {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function columnIndex(reference: string) {
  let index = 0;
  for (const letter of /^[A-Z]+/.exec(reference)?.[0] ?? "") {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }
  return index - 1;
}

export async function readXlsx(
  buffer: ArrayBuffer,
): Promise<{ rows: string[][]; date1904: boolean }> {
  const bytes = new Uint8Array(buffer);
  const parts = zipParts(bytes);
  const text = async (name: string) => {
    const part = parts.get(name);
    return part ? readPart(bytes, part) : null;
  };
  const workbook = await text("xl/workbook.xml");
  if (!workbook) throw new SheetError(NOT_XLSX);
  const date1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(workbook);

  // The first sheet in the workbook's order, through its relationship.
  const firstSheet = /<(?:\w+:)?sheet\b[^>]*>/.exec(workbook)?.[0] ?? "";
  const relation = attribute(firstSheet, "r:id");
  let target = "worksheets/sheet1.xml";
  for (const match of ((await text("xl/_rels/workbook.xml.rels")) ?? "").matchAll(
    /<Relationship\b[^>]*>/g,
  )) {
    if (relation && attribute(match[0], "Id") === relation) {
      target = attribute(match[0], "Target") ?? target;
    }
  }
  const sheet = await text(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  if (!sheet) throw new SheetError("That workbook has no sheet we can read.");

  const shared: string[] = [];
  for (const match of ((await text("xl/sharedStrings.xml")) ?? "").matchAll(
    /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g,
  )) {
    shared.push(stringText(match[1] ?? ""));
  }

  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const number = Number(attribute(row[1] ?? "", "r"));
    const index = number > 0 ? number - 1 : rows.length;
    if (index >= MAX_ROWS) break;
    const cells: string[] = [];
    let next = 0;
    for (const cell of (row[2] ?? "").matchAll(
      /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,
    )) {
      const attributes = cell[1] ?? "";
      const body = cell[2] ?? "";
      const reference = attribute(attributes, "r");
      const column = reference ? columnIndex(reference) : next;
      next = column + 1;
      if (column < 0 || column >= MAX_COLUMN) continue;
      const type = attribute(attributes, "t");
      const value = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1];
      cells[column] =
        type === "s"
          ? (shared[Number(value)] ?? "")
          : type === "inlineStr"
            ? stringText(body)
            : type === "b"
              ? value === "1"
                ? "TRUE"
                : "FALSE"
              : type === "e" || value === undefined
                ? ""
                : unescapeXml(value);
    }
    rows[index] = Array.from(cells, (cell) => cell ?? "");
  }
  return { rows: Array.from(rows, (row) => row ?? []), date1904 };
}
