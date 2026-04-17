import type { NextRequest } from "next/server";
import { searchWikipedia } from "@/lib/wikipedia";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const rate = checkRate(clientKey(request, "wiki-search"), 60, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, 200);
  if (!q) return Response.json([]);

  try {
    const results = await searchWikipedia(q);
    return Response.json(results);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Wikipedia search failed" },
      { status: 502 }
    );
  }
}
