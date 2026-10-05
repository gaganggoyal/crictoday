import { describe, expect, it } from "vitest";
import { hashLimitKey, RateLimiter } from "@/lib/security/rate-limit";

describe("rate limiter", () => {
  it("blocks inside the window and resets after it", () => {
    const limiter = new RateLimiter();
    expect(limiter.hit("auth", 2, 1000, 0).ok).toBe(true);
    expect(limiter.hit("auth", 2, 1000, 10).ok).toBe(true);
    expect(limiter.hit("auth", 2, 1000, 20).ok).toBe(false);
    expect(limiter.hit("auth", 2, 1000, 1000).ok).toBe(true);
  });

  it("hashes keys to a fixed hex digest", () => {
    expect(hashLimitKey("auth:fan@example.com:127.0.0.1")).toMatch(/^[a-f0-9]{64}$/);
  });
});
