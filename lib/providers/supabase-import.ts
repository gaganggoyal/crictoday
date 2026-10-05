import "server-only";
import { supabaseService } from "@/lib/data/supabase";
import { planImport, type ExistingImportRow, type NormalizedMatch } from "@/lib/domain/providers";
import { sportMonksFixtureProvider, ticketmasterProvider } from "@/lib/providers/fetchers";

type Applied = { inserted?: number; updated?: number; skipped?: number };

export async function runSupabaseImport(now = new Date()) {
  const client = supabaseService();
  if (!client) {
    return { status: "skipped", reason: "SUPABASE_SECRET_KEY is not set, so fixtures cannot be written." };
  }
  const provider = sportMonksFixtureProvider();
  const tickets = ticketmasterProvider();
  const started = await client.rpc("begin_import_run", { p_provider: provider ? "sportmonks" : "manual" });
  if (started.error) return { status: "failed", reason: "The import could not start." };
  const runId = started.data as string | null;
  if (!runId) return { status: "skipped", reason: "An import is already running." };

  const finish = (status: "succeeded" | "failed" | "skipped", counts: { fetched?: number; inserted?: number; updated?: number; failed?: number }, error: string | null) =>
    client.rpc("finish_import_run", {
      p_id: runId,
      p_status: status,
      p_fetched: counts.fetched ?? 0,
      p_inserted: counts.inserted ?? 0,
      p_updated: counts.updated ?? 0,
      p_failed: counts.failed ?? 0,
      p_error: error,
    });

  try {
    if (!provider) {
      await finish(
        "skipped",
        {},
        tickets
          ? "No fixture token configured. Ticketmaster is not allowed to publish offers on its own."
          : "No fixture provider token configured.",
      );
      return { status: "skipped", id: runId };
    }

    const incoming = await provider.fetchBetween({
      from: now,
      to: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
    });
    const index = await client.rpc("provider_match_index");
    if (index.error) throw new Error(index.error.message);
    const rows = (Array.isArray(index.data) ? index.data : []) as ExistingImportRow[];
    const plan = planImport(rows, incoming);
    for (const conflict of plan.conflicts) {
      await client.rpc("record_dead_letter", { p_provider: "sportmonks", p_reason: conflict.reason });
    }
    const applied = await client.rpc("apply_provider_plan", {
      p_inserts: plan.inserts,
      p_updates: plan.updates,
    });
    if (applied.error) throw new Error(applied.error.message);
    const counts = (typeof applied.data === "string" ? JSON.parse(applied.data) : applied.data) as Applied;

    let ticketFailures = 0;
    if (tickets) {
      for (const fixture of plan.inserts) {
        ticketFailures += await attachPending(client, tickets, fixture);
      }
    }

    const failed = plan.conflicts.length + ticketFailures + (counts.skipped ?? 0);
    await finish(
      "succeeded",
      {
        fetched: incoming.length,
        inserted: counts.inserted ?? 0,
        updated: counts.updated ?? 0,
        failed,
      },
      plan.conflicts.length > 0
        ? `${plan.conflicts.length} fixtures conflicted with existing records and were not written.`
        : null,
    );
    return { status: "succeeded", id: runId, fetched: incoming.length, conflicts: plan.conflicts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    await finish("failed", { failed: 1 }, message);
    await client.rpc("record_dead_letter", { p_provider: "sportmonks", p_reason: message });
    return { status: "failed", id: runId };
  }
}

async function attachPending(
  client: NonNullable<ReturnType<typeof supabaseService>>,
  tickets: NonNullable<ReturnType<typeof ticketmasterProvider>>,
  fixture: NormalizedMatch,
) {
  try {
    const found = await tickets.findOffers(fixture);
    if (found.length === 0) return 0;
    const saved = await client.rpc("attach_pending_offers", {
      p_external_id: fixture.externalId,
      p_offers: found.map((offer) => ({
        sellerName: offer.sellerName,
        url: offer.url,
        kind: offer.kind,
        currency: offer.currency,
        priceFrom: offer.priceFrom,
        status: "pending",
      })),
    });
    if (saved.error) {
      await client.rpc("record_dead_letter", { p_provider: "ticketmaster", p_reason: saved.error.message });
      return 1;
    }
    return 0;
  } catch (error) {
    await client.rpc("record_dead_letter", {
      p_provider: "ticketmaster",
      p_reason: error instanceof Error ? error.message : "Ticket lookup failed. No offer was published.",
    });
    return 1;
  }
}
