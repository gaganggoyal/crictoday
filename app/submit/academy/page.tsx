import { AcademyWizard } from "@/components/forms/wizards";
import { pageMetadata } from "@/lib/seo";
import { firstParam } from "@/lib/utils";

export const metadata = pageMetadata(
  "List a cricket academy",
  "Submit an academy profile. The public badge appears only after the contact is checked.",
  "/submit/academy",
);

export default async function SubmitAcademyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const claim = firstParam((await searchParams).claim) || "";
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">Academies</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        {claim ? "Claim an academy" : "List an academy"}
      </h1>
      <p className="mt-3 text-muted">Tell us who to contact and how you can prove the listing is yours.</p>
      <div className="mt-8">
        <AcademyWizard claimSlug={claim} />
      </div>
    </div>
  );
}
