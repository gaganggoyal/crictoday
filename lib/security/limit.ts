import "server-only";
import { dataMode } from "@/lib/data/mode";
import { supabaseService } from "@/lib/data/supabase";
import { hashLimitKey, limiter } from "@/lib/security/rate-limit";

export type LimitResult = { ok: boolean; retryAfterMs: number; unavailable?: boolean };

export async function limitHit(key: string, limit: number, windowMs: number): Promise<LimitResult> {
  if (dataMode() !== "supabase") return limiter.hit(key, limit, windowMs);
  const client = supabaseService();
  if (!client) return { ok: false, retryAfterMs: windowMs, unavailable: true };
  const { data, error } = await client.rpc("rate_limit_hit", {
    p_key: hashLimitKey(key),
    p_limit: limit,
    p_window_ms: windowMs,
  });
  if (error || data == null) return { ok: false, retryAfterMs: windowMs, unavailable: true };
  const body = (typeof data === "string" ? JSON.parse(data) : data) as { ok?: boolean; retry_after_ms?: number };
  return { ok: Boolean(body.ok), retryAfterMs: Number(body.retry_after_ms) || 0 };
}
