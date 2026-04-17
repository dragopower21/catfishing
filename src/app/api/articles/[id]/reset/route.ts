import { prisma } from "@/lib/db";
import { fetchArticle } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";
import { getOwnerId } from "@/lib/owner";
import { isAdmin } from "@/lib/admin";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "articles-reset"), 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
    include: { set: { select: { ownerId: true } } },
  });
  if (!article) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }
  const [ownerId, admin] = await Promise.all([getOwnerId(), isAdmin()]);
  if (!admin && (ownerId === null || ownerId !== article.set.ownerId)) {
    return Response.json(
      { error: "You can only reset articles in your own sets." },
      { status: 403 }
    );
  }

  let fetched;
  try {
    fetched = await fetchArticle(article.title);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }

  const filtered = filterCategories(fetched.categories, fetched.title);

  const updated = await prisma.article.update({
    where: { id },
    data: {
      categories: JSON.stringify(filtered),
      disabledCategories: JSON.stringify([]),
      aliases: JSON.stringify(fetched.aliases),
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
    },
  });

  await prisma.articleSet.update({
    where: { id: updated.setId },
    data: { updatedAt: new Date() },
  });

  return Response.json({
    id: updated.id,
    setId: updated.setId,
    title: updated.title,
    wikipediaUrl: updated.wikipediaUrl,
    wikipediaPageId: updated.wikipediaPageId,
    categories: filtered,
    disabledCategories: [],
    customHints: JSON.parse(updated.customHints) as string[],
    aliases: fetched.aliases,
    customAliases: JSON.parse(updated.customAliases) as string[],
    summary: updated.summary,
    thumbnailUrl: updated.thumbnailUrl,
    orderIndex: updated.orderIndex,
    createdAt: updated.createdAt,
  });
}
