import { notFound, permanentRedirect } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfilePage } from "@/lib/data/profile-page";
import { profilePath } from "@/lib/domain/profiles";
import { profileMetadata } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getProfilePage(slug);
  if (!page) notFound();
  const { profile } = page;
  return profileMetadata(
    profile,
    `${profile.name}, cricket academy in ${profile.cityName}`,
    profilePath(profile),
  );
}

export default async function AcademyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getProfilePage(slug);
  if (!page) notFound();
  if (page.profile.kind !== "academy") permanentRedirect(profilePath(page.profile));
  return <ProfileView {...page} />;
}
