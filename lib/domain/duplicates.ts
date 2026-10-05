export const DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000;

export function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function teamPairKey(home: string, away: string) {
  return [normalizeName(home), normalizeName(away)].sort().join("|");
}

export type DuplicateFields = {
  id: string;
  home: string;
  away: string;
  venue: string;
  competition: string;
  startsAt: string;
};

export function findDuplicateCandidates(
  existing: DuplicateFields[],
  candidate: Omit<DuplicateFields, "id">,
  windowMs = DUPLICATE_WINDOW_MS,
) {
  const start = new Date(candidate.startsAt).getTime();
  if (!Number.isFinite(start)) return [];
  const pair = teamPairKey(candidate.home, candidate.away);
  const venue = normalizeName(candidate.venue);
  const competition = normalizeName(candidate.competition);

  return existing.filter((match) => {
    const delta = Math.abs(new Date(match.startsAt).getTime() - start);
    if (!Number.isFinite(delta) || delta > windowMs) return false;
    if (teamPairKey(match.home, match.away) === pair) return true;
    return (
      normalizeName(match.competition) === competition &&
      normalizeName(match.venue) === venue &&
      delta <= 3 * 60 * 60 * 1000
    );
  });
}
