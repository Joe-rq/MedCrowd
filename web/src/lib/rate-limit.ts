// Rate limiting using KV fixed-window counter

import type { DbAdapter } from "./db/types";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp ms
}

const WINDOW_SECONDS = 60;

/**
 * Fixed-window rate limiter backed by KV store.
 * Key format: ratelimit:{identifier}:{windowId}
 */
export async function checkRateLimit(
  db: DbAdapter,
  identifier: string,
  limit: number
): Promise<RateLimitResult> {
  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${identifier}:${windowId}`;
  const resetAt = (windowId + 1) * WINDOW_SECONDS * 1000;

  const current = await db.get<number>(key);
  const count = current ?? 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  // Increment counter with TTL
  await db.set(key, count + 1, { ex: WINDOW_SECONDS + 5 });

  return { allowed: true, remaining: limit - count - 1, resetAt };
}
