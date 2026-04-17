import { prisma } from "@/lib/db";
import { fetchArticle } from "@/lib/wikipedia";

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

  const updated = await prisma.article.update({
    where: { id },
    data: {
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
    },
  });

  return Response.json({
    id: updated.id,
    summary: updated.summary,
    thumbnailUrl: updated.thumbnailUrl,
  });
}
