import { notFound, permanentRedirect } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfilePage } from "@/lib/data/profile-page";
import { PROFILE_KIND_LABEL, profilePath } from "@/lib/domain/profiles";
import { pageMetadata } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getProfilePage(slug);
  if (!page) notFound();
  const { profile } = page;
  return pageMetadata(
    `${profile.name}, cricket ${PROFILE_KIND_LABEL[profile.kind].toLowerCase()} in ${profile.cityName}`,
    profile.description,
    profilePath(profile),
  );
}

export default async function ClubPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getProfilePage(slug);
  if (!page) notFound();
  if (page.profile.kind === "academy") permanentRedirect(profilePath(page.profile));
  return <ProfileView {...page} />;
}
