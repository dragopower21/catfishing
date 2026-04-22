import { prisma } from "@/lib/db";
import { fetchArticle } from "@/lib/wikipedia";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

// Backfill of summary / thumbnail / pageViews / difficultyScore for
// articles added before those fields existed. No ownership check — this
// only writes columns Wikipedia owns and is rate-limited per IP. Returns
// early when the cached fields are already populated so nothing can force
// repeated external hits on the same article.
export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "refresh-media"), 60, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { id } = await params;

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  const needsMedia =
    article.summary === null && article.thumbnailUrl === null;
  const needsScore =
    article.pageViews === null || article.difficultyScore === null;

  if (!needsMedia && !needsScore) {
    return Response.json({
      id: article.id,
      summary: article.summary,
      thumbnailUrl: article.thumbnailUrl,
      pageViews: article.pageViews,
      difficultyScore: article.difficultyScore,
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

  const data: {
    summary?: string | null;
    thumbnailUrl?: string | null;
    pageViews?: number | null;
    difficultyScore?: number | null;
  } = {};
  if (needsMedia) {
    data.summary = fetched.summary;
    data.thumbnailUrl = fetched.thumbnailUrl;
  }
  if (needsScore) {
    data.pageViews = fetched.pageViews;
    data.difficultyScore = fetched.difficultyScore;
  }

  const updated = await prisma.article.update({
    where: { id },
    data,
  });

  return Response.json({
    id: updated.id,
    summary: updated.summary,
    thumbnailUrl: updated.thumbnailUrl,
    pageViews: updated.pageViews,
    difficultyScore: updated.difficultyScore,
  });
}
