import "server-only";
import type { Session } from "@/lib/auth/session";
import { dataMode } from "@/lib/data/mode";
import { mysqlPool } from "@/lib/data/mysql/pool";
import { loadOwnerProfile, loadOwnerProfiles, loadProfileQueue } from "@/lib/data/mysql/profiles";
import { readStore } from "@/lib/data/store";
import type { StoredAcademy, StoredMatch } from "@/lib/domain/types";
import { mergeAcademies } from "@/lib/domain/workflows";

/** Owners create and edit profiles only where the MySQL database runs, as in production. */
export function profilesEnabled() {
  return dataMode() === "mysql";
}

const owner = (session: Session) => ({ userId: session.userId, email: session.email });

/** The profiles on an account. The demo store shows its sample academies read-only. */
export async function ownerProfiles(session: Session): Promise<StoredAcademy[]> {
  if (dataMode() === "mysql") return loadOwnerProfiles(mysqlPool(), owner(session));
  if (dataMode() === "demo") {
    const email = session.email.toLowerCase();
    return mergeAcademies(readStore()).filter((academy) => academy.ownerEmail === email);
  }
  return [];
}

export async function ownerProfile(
  session: Session,
  slug: string,
): Promise<{ profile: StoredAcademy; matches: StoredMatch[] } | null> {
  if (dataMode() !== "mysql") return null;
  return loadOwnerProfile(mysqlPool(), owner(session), slug);
}

export async function profileQueue(): Promise<{
  pending: StoredAcademy[];
  recent: StoredAcademy[];
}> {
  if (dataMode() !== "mysql") return { pending: [], recent: [] };
  return loadProfileQueue(mysqlPool());
}
