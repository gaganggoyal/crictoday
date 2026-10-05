import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Terms",
  "Terms for using cricketmatch.today.",
  "/legal/terms",
);

export default function TermsPage() {
  return (
    <article className="prose-page mx-auto grid w-full max-w-3xl gap-4 px-5 py-12 text-[17px] leading-7">
      <h1 className="font-display text-5xl font-extrabold">Terms</h1>
      <p>
        cricketmatch.today helps people find cricket they can attend and the ticket route we have
        reviewed. We do not operate a box office and we do not run a resale market.
      </p>
      <p>
        Fixture details can change. Check the source and the last verification time before you
        travel or pay. A ticket alert is a notification, not a reservation and not a promise that
        seats exist.
      </p>
      <p>
        Organisers must have the right to submit a fixture and a ticket URL. We can reject,
        unpublish or correct a listing. Do not submit contact details that are not yours, or a link
        you are not allowed to share.
      </p>
      <p>
        These terms are a product summary for the MVP, not a substitute for local consumer or
        ticketing law.
      </p>
    </article>
  );
}
