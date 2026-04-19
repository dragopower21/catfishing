import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const countParam = request.nextUrl.searchParams.get("count") ?? "10";
  const requested = Number.parseInt(countParam, 10);
  if (Number.isNaN(requested) || requested < 1) {
    return Response.json({ error: "Invalid count" }, { status: 400 });
  }
  const count = Math.min(Math.max(requested, 3), 50);

  // Exclude articles from hidden sets — Random is a public pool.
  const all = await prisma.article.findMany({
    where: { set: { hidden: false } },
  });
  if (all.length === 0) {
    return Response.json(
      { error: "No articles yet. Create a set first to play Random." },
      { status: 404 }
    );
  }

  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  const articles = picked.map((a) => ({
    id: a.id,
    setId: a.setId,
    title: a.title,
    wikipediaUrl: a.wikipediaUrl,
    wikipediaPageId: a.wikipediaPageId,
    categories: JSON.parse(a.categories) as string[],
    disabledCategories: JSON.parse(a.disabledCategories) as string[],
    customHints: JSON.parse(a.customHints) as string[],
    aliases: JSON.parse(a.aliases) as string[],
    customAliases: JSON.parse(a.customAliases) as string[],
    summary: a.summary,
    thumbnailUrl: a.thumbnailUrl,
    orderIndex: a.orderIndex,
    createdAt: a.createdAt,
  }));
  return Response.json({ articles });
}
