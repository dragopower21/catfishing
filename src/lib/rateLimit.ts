/**
 * Tiny in-memory token-bucket rate limiter.
 *
 * Caveat: on Vercel's serverless runtime this resets between cold starts
 * and isn't shared across instances — so it's a best-effort throttle
 * that catches spam from a single active instance, not a hardened DoS
 * defense. For stronger guarantees, swap this module for Upstash/Redis.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  resetInMs: number;
};

export function checkRate(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      // Lazy eviction: drop the oldest half when the map is too big.
      const entries = [...buckets.entries()].sort(
        (a, b) => a[1].resetAt - b[1].resetAt
      );
      for (let i = 0; i < Math.floor(entries.length / 2); i++) {
        buckets.delete(entries[i][0]);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetInMs: windowMs };
  }

  if (bucket.count >= max) {
    return { allowed: false, resetInMs: bucket.resetAt - now };
  }

  bucket.count++;
  return { allowed: true, resetInMs: bucket.resetAt - now };
}

export function clientKey(request: Request, scope: string): string {
  const xff = request.headers.get("x-forwarded-for");
  const ip =
    (xff ? xff.split(",")[0].trim() : "") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

export function tooManyRequests(resetInMs: number): Response {
  const retryAfter = Math.max(1, Math.ceil(resetInMs / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Slow down a bit." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
