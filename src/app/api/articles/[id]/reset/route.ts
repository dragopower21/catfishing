import { prisma } from "@/lib/db";
import { fetchArticle } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return Response.json({ error: "Article not found" }, { status: 404 });
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
    customHints: JSON.parse(updated.customHints) as string[],
    aliases: fetched.aliases,
    summary: updated.summary,
    thumbnailUrl: updated.thumbnailUrl,
    orderIndex: updated.orderIndex,
    createdAt: updated.createdAt,
  });
}
