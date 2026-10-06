import { redirect } from "next/navigation";

// Academies are managed with every other profile on the account overview.
export default function DashboardAcademyPage() {
  redirect("/dashboard");
}
