import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "About demo data",
  "How illustrative fixtures are labelled and why they never ship as live inventory.",
  "/about/demo-data",
);

export default function DemoDataPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-12">
      <h1 className="font-display text-5xl font-extrabold">Demo data</h1>
      <div className="mt-6 grid gap-4 text-[17px] leading-7">
        <p>
          When no database is configured, local development shows a labelled DEMO catalogue so the
          product can be reviewed. Those fixtures, prices and ticket links are illustrative. They
          are not a live feed and they are not an offer to sell a seat.
        </p>
        <p>
          The live site lists only fixtures taken from official sources, each linked to its source.
          The DEMO catalogue appears there only if an operator loads it on purpose, and a banner
          says so while it is listed. Provider imports never overwrite an organiser-verified record
          without moderation.
        </p>
        <p>
          The source link on a demo match returns to this page so the origin of the listing stays
          visible.
        </p>
      </div>
    </article>
  );
}
