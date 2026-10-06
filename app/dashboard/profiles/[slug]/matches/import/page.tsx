import Link from "next/link";
import { notFound } from "next/navigation";
import { ScheduleImport } from "@/components/profile/schedule-import";
import { getSession } from "@/lib/auth/session";
import { ownerProfile } from "@/lib/data/profiles";
import { MAX_IMPORT_ROWS } from "@/lib/domain/schedule";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Add matches from a spreadsheet",
  "Upload or paste a schedule of matches.",
  "/dashboard",
  false,
);

const COLUMNS: Array<[string, string, string]> = [
  ["Date", "01/11/2026", "Day first. 1 Nov 2026 and 2026-11-01 work too."],
  ["Start time", "9:30 am", "Local time at the ground. 14:00 works too."],
  ["Home side", "Dadar Strikers", "Or one Match column: Dadar Strikers vs Matunga Lions."],
  ["Away side", "Matunga Lions", "An Opponent column works too."],
  ["Ground", "Shivaji Park", "Empty uses your profile's ground."],
  ["Town", "Mumbai", "Empty uses your profile's town."],
  ["Tournament", "Diwali Cup", "Optional. Empty means a friendly."],
  ["Format", "T20", "T20, One-day, T10, Multi-day, or anything else."],
  ["Entry", "Free", "Free, Tickets or Private. Empty means free."],
  ["Entry notes", "Seats on the grass bank", "Optional."],
  ["Ticket link", "", "Optional, a full https address. A moderator checks it."],
];

export default async function ImportMatchesPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { slug } = await params;
  const data = await ownerProfile(session, slug);
  if (!data || data.profile.verificationStatus === "rejected") notFound();
  const { profile } = data;
  const verified = profile.verificationStatus === "verified";
  return (
    <div className="grid gap-10">
      <div className="max-w-3xl">
        <p className="text-sm">
          <Link href={`/dashboard/profiles/${profile.slug}`}>{profile.name}</Link>
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold">
          Add matches from a spreadsheet
        </h1>
        <p className="mt-3 text-muted">
          Put up a whole season or tournament at once, up to {MAX_IMPORT_ROWS} matches. You see
          every row before anything is saved.{" "}
          {verified
            ? "Added matches go live at once."
            : "Added matches go live when your profile passes its check."}{" "}
          Adding the sheet again later updates changed times and grounds and skips matches already
          listed.
        </p>
      </div>

      <ScheduleImport profile={profile.slug} verified={verified} />

      <section aria-labelledby="layout-heading" className="grid gap-4">
        <h2 id="layout-heading" className="font-display text-3xl font-extrabold">
          How to lay out the sheet
        </h2>
        <p className="max-w-3xl text-muted">
          One row for each match, under a header row. Columns can be in any order, and columns we do
          not know are left out. Start from the{" "}
          <a className="text-link" href="/templates/match-schedule.csv" download>
            template
          </a>
          , or name your own columns like this:
        </p>
        <div className="overflow-x-auto rounded-[1.25rem] border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="px-4 py-3 font-semibold">Column</th>
                <th className="px-4 py-3 font-semibold">Example</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map(([name, example, note]) => (
                <tr key={name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium">{name}</td>
                  <td className="px-4 py-2.5">{example}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {name === "Ground" ? `Empty uses ${profile.address}.` : null}
                    {name === "Town" ? `Empty uses ${profile.cityName}.` : null}
                    {name === "Home side" && (profile.kind === "academy" || profile.kind === "club")
                      ? `With only an Opponent column, the home side is ${profile.name}. `
                      : null}
                    {name === "Ground" || name === "Town" ? null : note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-sm text-muted">
          {profile.countrySlug === "india"
            ? "A State column is optional: the state comes from the town when we know it. "
            : ""}
          A Status column can say postponed or cancelled. To move a match to another day, edit it
          from your profile instead: a new date counts as a new match.
        </p>
      </section>
    </div>
  );
}
