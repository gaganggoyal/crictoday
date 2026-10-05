import "server-only";
import { connection } from "next/server";
import { countries, leagues } from "@/lib/data/seed";
import { dataMode } from "@/lib/data/mode";
import { readStore } from "@/lib/data/store";
import { mapAcademyRow, mapMatchRow, supabaseAnon } from "@/lib/data/supabase";
import { isPublicMatch, type StoredAcademy, type StoredMatch } from "@/lib/domain/types";
import { mergeAcademies, mergeMatches } from "@/lib/domain/workflows";

export type Directory = {
  mode: ReturnType<typeof dataMode>;
  matches: StoredMatch[];
  academies: StoredAcademy[];
  countries: typeof countries;
  leagues: typeof leagues;
};

export async function getDirectory(): Promise<Directory> {
  await connection();
  const mode = dataMode();
  if (mode === "supabase") {
    const client = supabaseAnon();
    if (!client) throw new Error("Supabase is not configured.");
    const [matchResult, academyResult] = await Promise.all([
      client.from("match_directory").select("*"),
      client.from("academy_directory").select("*"),
    ]);
    if (matchResult.error) throw new Error(matchResult.error.message);
    if (academyResult.error) throw new Error(academyResult.error.message);
    return {
      mode,
      matches: (matchResult.data ?? []).map((row) => mapMatchRow(row)),
      academies: (academyResult.data ?? []).map((row) => mapAcademyRow(row)),
      countries,
      leagues,
    };
  }
  if (mode === "unconfigured") {
    return { mode, matches: [], academies: [], countries, leagues };
  }
  const store = readStore();
  return {
    mode,
    matches: mergeMatches(store).filter((match) => isPublicMatch(match)),
    academies: mergeAcademies(store).filter((academy) => academy.verificationStatus === "verified"),
    countries,
    leagues,
  };
}

export async function getMatch(slug: string) {
  const directory = await getDirectory();
  return directory.matches.find((match) => match.slug === slug) ?? null;
}

export async function getAcademy(slug: string) {
  const directory = await getDirectory();
  const store = dataMode() === "demo" ? readStore() : null;
  const all = store ? mergeAcademies(store) : directory.academies;
  return (
    all.find((academy) => academy.slug === slug && academy.verificationStatus === "verified") ??
    null
  );
}
