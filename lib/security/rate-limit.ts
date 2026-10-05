import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

export function hashLimitKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  hit(key: string, limit: number, windowMs: number, now = Date.now()) {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterMs: 0 };
    }
    if (current.count >= limit) {
      return { ok: false, retryAfterMs: current.resetAt - now };
    }
    current.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }
}

export const limiter = new RateLimiter();
