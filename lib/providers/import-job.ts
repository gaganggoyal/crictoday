import "server-only";
import { planImport } from "@/lib/domain/providers";
import type { ImportRun, StoredOffer } from "@/lib/domain/types";
import { applyImportPlan, expireDue, mergeMatches } from "@/lib/domain/workflows";
import { dataMode } from "@/lib/data/mode";
import { runMysqlImport } from "@/lib/data/mysql/import";
import { mysqlPool } from "@/lib/data/mysql/pool";
import { readStore, writeStore } from "@/lib/data/store";
import { sportMonksFixtureProvider, ticketmasterProvider } from "@/lib/providers/fetchers";
import { runSupabaseImport } from "@/lib/providers/supabase-import";

export async function runImport(now = new Date()) {
  const mode = dataMode();
  if (mode === "mysql") {
    return runMysqlImport(
      mysqlPool(),
      { fixtures: sportMonksFixtureProvider(), tickets: ticketmasterProvider() },
      now,
    );
  }
  if (mode === "supabase") return runSupabaseImport(now);
  if (mode === "unconfigured") {
    return { status: "skipped", reason: "No database is configured." };
  }
  const store = readStore();
  const active = store.importRuns.find(
    (run) =>
      run.status === "running" &&
      now.getTime() - new Date(run.startedAt).getTime() < 10 * 60 * 1000,
  );
  if (active) {
    return { status: "skipped", reason: "An import is already running." };
  }

  const provider = sportMonksFixtureProvider();
  const tickets = ticketmasterProvider();
  const run: ImportRun = {
    id: crypto.randomUUID(),
    provider: provider ? "sportmonks" : "manual",
    startedAt: now.toISOString(),
    finishedAt: null,
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 0,
    status: "running",
    errorSummary: null,
  };
  store.importRuns = [run, ...store.importRuns];
  writeStore(store);

  try {
    const current = readStore();
    if (!provider) {
      const finished = expireDue(
        {
          ...current,
          importRuns: current.importRuns.map((item) =>
            item.id === run.id
              ? {
                  ...item,
                  status: "skipped" as const,
                  finishedAt: new Date().toISOString(),
                  errorSummary: tickets
                    ? "No fixture token configured. Ticketmaster is not allowed to publish offers on its own."
                    : "No fixture provider token configured.",
                }
              : item,
          ),
        },
        now,
      );
      writeStore(finished);
      return { status: "skipped", id: run.id };
    }

    const incoming = await provider.fetchBetween({
      from: now,
      to: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
    });
    const plan = planImport(
      mergeMatches(current).map((match) => ({
        id: match.id,
        sourceExternalId: match.sourceExternalId,
        sourceType: match.sourceType,
        home: match.homeName,
        away: match.awayName,
        venue: match.venueName,
        competition: match.competitionName,
        startsAt: match.startsAt,
      })),
      incoming,
    );
    const applied = applyImportPlan(current, plan, new Date());
    let working = applied.store;
    const deadLetters = plan.conflicts.map((conflict) => ({
      id: crypto.randomUUID(),
      provider: "sportmonks",
      reason: conflict.reason,
      createdAt: new Date().toISOString(),
    }));
    if (tickets) {
      for (const fixture of plan.inserts) {
        const created = working.extraMatches.find(
          (item) => item.sourceExternalId === fixture.externalId,
        );
        if (!created) continue;
        try {
          const found = await tickets.findOffers(fixture);
          const pending: StoredOffer[] = found.map((offer) => ({
            id: crypto.randomUUID(),
            sellerName: offer.sellerName,
            sellerDomain: offer.sellerDomain,
            url: offer.url,
            kind: offer.kind,
            currency: offer.currency,
            priceFrom: offer.priceFrom,
            status: "pending",
            lastCheckedAt: new Date().toISOString(),
            approved: false,
          }));
          if (pending.length === 0) continue;
          working = {
            ...working,
            extraMatches: working.extraMatches.map((item) =>
              item.id === created.id ? { ...item, offers: pending } : item,
            ),
          };
        } catch (error) {
          deadLetters.push({
            id: crypto.randomUUID(),
            provider: "ticketmaster",
            reason:
              error instanceof Error
                ? error.message
                : "Ticket lookup failed. No offer was published.",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    const next = expireDue(
      {
        ...working,
        deadLetters: [...deadLetters, ...current.deadLetters].slice(0, 200),
        importRuns: current.importRuns.map((item) =>
          item.id === run.id
            ? {
                ...item,
                status: "succeeded" as const,
                finishedAt: new Date().toISOString(),
                fetchedCount: incoming.length,
                insertedCount: applied.inserted,
                updatedCount: applied.updated,
                failedCount:
                  plan.conflicts.length +
                  deadLetters.filter((item) => item.provider === "ticketmaster").length,
                errorSummary:
                  plan.conflicts.length > 0
                    ? `${plan.conflicts.length} fixtures conflicted with existing records and were not written.`
                    : null,
              }
            : item,
        ),
      },
      now,
    );
    writeStore(next);
    return {
      status: "succeeded",
      id: run.id,
      fetched: incoming.length,
      conflicts: plan.conflicts.length,
    };
  } catch (error) {
    const current = readStore();
    writeStore({
      ...current,
      importRuns: current.importRuns.map((item) =>
        item.id === run.id
          ? {
              ...item,
              status: "failed",
              finishedAt: new Date().toISOString(),
              failedCount: 1,
              errorSummary: error instanceof Error ? error.message : "Import failed.",
            }
          : item,
      ),
      deadLetters: [
        {
          id: crypto.randomUUID(),
          provider: "sportmonks",
          reason: error instanceof Error ? error.message : "Import failed.",
          createdAt: new Date().toISOString(),
        },
        ...current.deadLetters,
      ],
    });
    return { status: "failed", id: run.id };
  }
}
