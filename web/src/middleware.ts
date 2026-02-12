import { NextRequest, NextResponse } from "next/server";

const WINDOW_SECONDS = 60;

// Route-specific limits per window
const CONSULTATION_LIMIT = 10; // authenticated: 10/min for consultation
const DEFAULT_LIMIT = 60; // authenticated: 60/min for other APIs
const ANON_LIMIT = 20; // unauthenticated: 20/min

// Auth routes are exempt from rate limiting
const EXEMPT_PREFIXES = ["/api/auth/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Exempt auth routes
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip rate limiting if KV is not configured (local dev)
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return NextResponse.next();
  }

  // Determine identifier: userId from session cookie or IP
  // We can't decrypt iron-session in Edge, so use the cookie existence + IP as identifier
  const sessionCookie = request.cookies.get("medcrowd_session");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const isAuthenticated = !!sessionCookie?.value;

  // Use cookie hash as part of identifier for authenticated users (stable per session)
  const identifier = isAuthenticated
    ? `user:${hashCode(sessionCookie!.value)}`
    : `ip:${ip}`;

  // Determine limit
  let limit = isAuthenticated ? DEFAULT_LIMIT : ANON_LIMIT;
  if (pathname === "/api/consultation" && request.method === "POST") {
    limit = isAuthenticated ? CONSULTATION_LIMIT : ANON_LIMIT;
  }

  // Fixed-window counter via Upstash REST API
  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${identifier}:${windowId}`;

  try {
    const count = await kvIncr(kvUrl, kvToken, key, WINDOW_SECONDS + 5);

    if (count > limit) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": String(WINDOW_SECONDS),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(limit));
    response.headers.set("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
    return response;
  } catch (err) {
    // If rate limiting fails, allow the request (fail open)
    console.error("[Middleware] Rate limit check failed:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: "/api/:path*",
};

// Simple hash for session cookie to create stable identifier without exposing cookie value
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

// Direct Upstash REST call for INCR + EXPIRE (works in Edge runtime)
async function kvIncr(baseUrl: string, token: string, key: string, ttl: number): Promise<number> {
  // INCR
  const incrRes = await fetch(`${baseUrl}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const incrData = await incrRes.json();
  const count = incrData.result as number;

  // Set TTL only on first increment (count === 1)
  if (count === 1) {
    await fetch(`${baseUrl}/expire/${encodeURIComponent(key)}/${ttl}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return count;
}
