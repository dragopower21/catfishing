import type { NextRequest } from "next/server";
import {
  fetchUsefulCategoryCounts,
  searchWikipedia,
} from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const rate = checkRate(clientKey(request, "wiki-search"), 60, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, 200);
  if (!q) return Response.json([]);

  try {
    const results = await searchWikipedia(q);
    if (results.length === 0) return Response.json([]);

    const counts = await fetchUsefulCategoryCounts(
      results.map((r) => r.title),
      filterCategories
    );
    const decorated = results.map((r) => ({
      ...r,
      categoryCount: counts.has(r.title) ? counts.get(r.title)! : null,
    }));
    return Response.json(decorated);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Wikipedia search failed" },
      { status: 502 }
    );
  }
}
