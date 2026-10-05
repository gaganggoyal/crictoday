import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchGrid } from "@/components/match/match-grid";
import { getAcademy, getDirectory } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademy(slug);
  if (!academy) notFound();
  return pageMetadata(
    `${academy.name} cricket academy in ${academy.cityName}`,
    academy.description,
    `/academy/${academy.slug}`,
  );
}

export default async function AcademyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademy(slug);
  if (!academy) notFound();
  const directory = await getDirectory();
  const fixtures = directory.matches.filter((match) => match.academySlug === academy.slug);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(academy.address)}`;
  return (
    <article className="mx-auto w-full max-w-[1120px] px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-link uppercase">{academy.verificationLabel}</p>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">{academy.name}</h1>
      <p className="mt-3 max-w-2xl text-muted">{academy.description}</p>
      <dl className="mt-8 grid gap-4 rounded-[1.25rem] border border-line bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Address</dt>
          <dd>{academy.address}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Last checked</dt>
          <dd>{academy.lastVerifiedAt ? new Date(academy.lastVerifiedAt).toUTCString() : "Not checked"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Age groups</dt>
          <dd>{academy.ageGroups.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Facilities</dt>
          <dd>{academy.facilities.join(", ")}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4" href={mapHref} target="_blank" rel="noopener noreferrer">
          Open map
        </a>
        {academy.website ? (
          <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4" href={academy.website} target="_blank" rel="noopener noreferrer">
            Website
          </a>
        ) : null}
        {academy.contactEmail ? (
          <a className="inline-flex min-h-11 items-center rounded-full bg-[#176B43] px-4 text-white" href={`mailto:${academy.contactEmail}`}>
            Email the academy
          </a>
        ) : null}
        <Link className="inline-flex min-h-11 items-center rounded-full border border-line px-4" href={`/submit/academy?claim=${academy.slug}`}>
          Claim this profile
        </Link>
      </div>
      <section className="mt-10">
        <h2 className="mb-4 font-display text-3xl font-extrabold">Upcoming fixtures</h2>
        {fixtures.length ? <MatchGrid matches={fixtures} now={new Date()} /> : <p className="text-muted">No public fixtures are listed yet.</p>}
      </section>
    </article>
  );
}
