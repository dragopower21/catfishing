import type { NextRequest } from "next/server";
import { searchWikipedia } from "@/lib/wikipedia";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json([]);

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
