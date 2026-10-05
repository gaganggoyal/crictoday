import { MatchWizard } from "@/components/forms/wizards";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "List a cricket match",
  "Submit a fixture for review. It is not public until a moderator approves the source.",
  "/submit/match",
);

export default function SubmitMatchPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Organisers</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">List a match</h1>
      <p className="mt-3 text-muted">
        Three steps. Nothing is published from this form. Ticket links stay pending even after the fixture is approved.
      </p>
      <div className="mt-8">
        <MatchWizard />
      </div>
    </div>
  );
}
