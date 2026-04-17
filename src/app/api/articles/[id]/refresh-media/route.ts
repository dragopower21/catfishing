import { prisma } from "@/lib/db";
import { fetchArticle } from "@/lib/wikipedia";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

// Anyone who's playing a set can trigger a one-shot backfill of
// summary/thumbnail on articles that are missing them. No ownership
// check — this is a read-adjacent enrichment that only affects columns
// Wikipedia already provides. Rate limited per IP.
export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "refresh-media"), 60, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { id } = await params;

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  // Skip the Wikipedia hit entirely if we already have data; bad actors
  // can't force repeated external requests this way.
  if (article.summary !== null || article.thumbnailUrl !== null) {
    return Response.json({
      id: article.id,
      summary: article.summary,
      thumbnailUrl: article.thumbnailUrl,
    });
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
