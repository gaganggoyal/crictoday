"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkScheduleAction, importScheduleAction } from "@/app/profile-actions";
import { Error } from "@/components/forms/request-form";
import type { ScheduleOutcome, ScheduleResult } from "@/lib/data/mysql/schedule";
import {
  SCHEDULE_FIELD_LABEL,
  SheetError,
  decodeSheetText,
  fitSheet,
  parseDelimited,
} from "@/lib/domain/schedule";
import { OWNER_FORMAT_LABEL, OWNER_FORMATS } from "@/lib/validation/profile";

type Failure = { ok: false; errors: Record<string, string> };
type Sheet = { rows: string[][]; date1904: boolean; label: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const WILL: Record<ScheduleOutcome, string> = {
  add: "Will be added",
  update: "Will be updated",
  same: "Already listed",
  past: "Already played, skipped",
  error: "Needs fixing",
};
const DID: Record<ScheduleOutcome, string> = {
  add: "Added",
  update: "Updated",
  same: "Already listed",
  past: "Already played, skipped",
  error: "Not added",
};
const ENTRY: Record<string, string> = {
  free: "Free entry",
  ticketed: "Tickets",
  private: "Private",
};

const formatLabel = (format: string) =>
  (OWNER_FORMATS as readonly string[]).includes(format)
    ? format === "other"
      ? ""
      : OWNER_FORMAT_LABEL[format as (typeof OWNER_FORMATS)[number]]
    : "";

async function readSheetFile(file: File): Promise<Omit<Sheet, "label">> {
  if (file.size > MAX_FILE_BYTES) {
    throw new SheetError("That file is over 5 MB. Keep it to the schedule and try again.");
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || file.type === XLSX_TYPE) {
    const { readXlsx } = await import("@/lib/sheets/xlsx");
    return readXlsx(await file.arrayBuffer());
  }
  if (/\.(xls|ods|numbers)$/.test(name)) {
    throw new SheetError(
      "Save the sheet as .xlsx or .csv first: in Excel use File, Save As; in Google Sheets, File, Download.",
    );
  }
  return { rows: parseDelimited(decodeSheetText(await file.arrayBuffer())), date1904: false };
}

/** Upload or paste a schedule, see what each row will do, then add it in one go. */
export function ScheduleImport({ profile, verified }: { profile: string; verified: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paste, setPaste] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const send = (next: Sheet, commit: boolean) =>
    startTransition(async () => {
      setError(null);
      const rows = fitSheet(next.rows);
      const body = new FormData();
      body.set("profile", profile);
      body.set("rows", JSON.stringify(rows));
      body.set("date1904", next.date1904 ? "1" : "0");
      const outcome: ScheduleResult | Failure = commit
        ? await importScheduleAction(body)
        : await checkScheduleAction(body);
      if (!outcome.ok) {
        setError(Object.values(outcome.errors)[0] ?? "That did not work. Try again.");
        return;
      }
      setSheet({ ...next, rows });
      setResult(outcome);
      setOnlyProblems(false);
      if (commit) router.refresh();
    });

  const reset = () => {
    setSheet(null);
    setResult(null);
    setError(null);
  };

  if (!result || !sheet) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-3 rounded-[1.25rem] border border-line bg-surface p-5">
            <h2 className="font-display text-2xl font-extrabold">Upload a file</h2>
            <p className="text-sm text-muted">
              An Excel (.xlsx) or CSV file: our template, or your own sheet with a header row.
            </p>
            <label className="inline-flex min-h-12 w-fit cursor-pointer items-center rounded-full bg-[#176B43] px-6 font-medium text-white has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link">
              {pending ? "Reading" : "Choose a file"}
              <input
                type="file"
                accept=".xlsx,.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={pending}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    send({ ...(await readSheetFile(file)), label: file.name }, false);
                  } catch (problem) {
                    setError(
                      problem instanceof SheetError
                        ? problem.message
                        : "That file could not be read. Save it as .csv and try again.",
                    );
                  }
                }}
              />
            </label>
            <a
              className="text-sm font-medium text-link"
              href="/templates/match-schedule.csv"
              download
            >
              Download the template
            </a>
          </div>
          <form
            className="grid content-start gap-3 rounded-[1.25rem] border border-line bg-surface p-5"
            onSubmit={(event) => {
              event.preventDefault();
              send(
                { rows: parseDelimited(paste), date1904: false, label: "the pasted rows" },
                false,
              );
            }}
          >
            <h2 className="font-display text-2xl font-extrabold">Or paste rows</h2>
            <label className="grid gap-1.5 text-sm text-muted" htmlFor="schedule-paste">
              In Excel or Google Sheets, select your rows with the header row, copy, and paste them
              here.
            </label>
            <textarea
              id="schedule-paste"
              className="field min-h-36 font-mono text-xs"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              placeholder={"Date\tStart time\tHome side\tAway side\tGround\n01/11/2026\t9:30 am\t…"}
              spellCheck={false}
            />
            <button
              className="inline-flex min-h-12 w-fit items-center rounded-full border border-line bg-surface px-6 font-medium disabled:opacity-60"
              disabled={pending || !paste.trim()}
            >
              {pending ? "Checking" : "Check these rows"}
            </button>
          </form>
        </div>
        <div role="status" aria-live="polite">
          <Error message={error ?? undefined} />
        </div>
      </div>
    );
  }

  const counts = result.rows.reduce<Record<ScheduleOutcome, number>>(
    (total, row) => ({ ...total, [row.outcome]: total[row.outcome] + 1 }),
    { add: 0, update: 0, same: 0, past: 0, error: 0 },
  );
  const ready = counts.add + counts.update;
  const shown = onlyProblems ? result.rows.filter((row) => row.outcome === "error") : result.rows;
  const known = result.columns.filter((column) => column.field);
  const ignored = result.columns.filter((column) => !column.field);
  const labels = result.committed ? DID : WILL;

  return (
    <div className="grid gap-5">
      {result.committed ? (
        <div role="status" className="rounded-2xl bg-surface px-4 py-3">
          <p className="font-medium">
            Done: {counts.add} {counts.add === 1 ? "match" : "matches"} added
            {counts.update ? ` and ${counts.update} updated` : ""}.{" "}
            {verified ? "They are live now." : "They go live when your profile passes its check."}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link className="text-link" href={`/dashboard/profiles/${profile}#matches`}>
              See your matches
            </Link>
            <button type="button" className="text-link underline" onClick={reset}>
              Add another sheet
            </button>
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <p>
            Read {result.rows.length} {result.rows.length === 1 ? "row" : "rows"} from {sheet.label}
            . Nothing is saved yet.
          </p>
          <p className="text-sm text-muted">
            Columns used:{" "}
            {known
              .map((column) => `${column.name} (${SCHEDULE_FIELD_LABEL[column.field!]})`)
              .join(", ")}
            {ignored.length ? `. Left out: ${ignored.map((column) => column.name).join(", ")}` : ""}
            .
          </p>
        </div>
      )}

      <ul className="flex flex-wrap gap-2 text-sm" aria-label="Summary">
        {(Object.keys(counts) as ScheduleOutcome[])
          .filter((outcome) => counts[outcome])
          .map((outcome) => (
            <li
              key={outcome}
              className={
                outcome === "error"
                  ? "rounded-full bg-[#8C2F1B] px-3 py-1 text-white"
                  : outcome === "add" || outcome === "update"
                    ? "rounded-full bg-[#176B43] px-3 py-1 text-white"
                    : "rounded-full border border-line px-3 py-1"
              }
            >
              {counts[outcome]} {labels[outcome].toLowerCase()}
            </li>
          ))}
      </ul>

      {result.committed ? null : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex min-h-12 items-center rounded-full bg-[#176B43] px-6 font-medium text-white disabled:opacity-60"
              disabled={pending || ready === 0}
              onClick={() => send(sheet, true)}
            >
              {pending
                ? "Saving"
                : ready === 0
                  ? "Nothing to add"
                  : [
                      counts.add
                        ? `Add ${counts.add} ${counts.add === 1 ? "match" : "matches"}`
                        : "",
                      counts.update ? `${counts.add ? "update" : "Update"} ${counts.update}` : "",
                    ]
                      .filter(Boolean)
                      .join(" and ")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-6 font-medium"
              onClick={reset}
              disabled={pending}
            >
              Use another sheet
            </button>
          </div>
          {counts.error ? (
            <p className="text-sm text-muted">
              Rows that need fixing are left out. Fix them in your sheet and add it again later:
              matches already added are skipped.
            </p>
          ) : null}
          <Error message={error ?? undefined} />
        </div>
      )}

      {counts.error && result.rows.length > 10 ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(event) => setOnlyProblems(event.target.checked)}
          />
          Show only rows that need fixing
        </label>
      ) : null}

      <ol className="grid gap-3" aria-label="Rows">
        {shown.map((row) => (
          <li
            key={row.line}
            className={`grid gap-1 rounded-2xl border bg-surface p-4 ${row.outcome === "error" ? "border-[#8C2F1B]" : "border-line"}`}
          >
            <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold tracking-[0.12em] uppercase">
              <span className="text-muted">Row {row.line}</span>
              <span className={row.outcome === "error" ? "text-danger" : "text-link"}>
                {labels[row.outcome]}
              </span>
            </p>
            <p className="font-semibold">
              {row.homeTeam || "Home side?"} vs {row.awayTeam || "Away side?"}
            </p>
            <p className="text-sm text-muted">
              {[row.when, [row.ground, row.city].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {row.competition || formatLabel(row.format) || row.attendance ? (
              <p className="text-sm text-muted">
                {[row.competition, formatLabel(row.format), ENTRY[row.attendance]]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {row.filled.length && row.outcome !== "error" ? (
              <p className="text-xs text-muted">From your profile: {row.filled.join(", ")}.</p>
            ) : null}
            {row.problems.length ? (
              <ul className="mt-1 grid gap-1 text-sm text-danger">
                {row.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
            {result.committed && row.slug && (row.outcome === "add" || row.outcome === "update") ? (
              <Link
                className="text-sm text-link"
                href={
                  verified
                    ? `/match/${row.slug}`
                    : `/dashboard/profiles/${profile}/matches/${row.slug}`
                }
              >
                {verified ? "See the match page" : "Edit the match"}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
