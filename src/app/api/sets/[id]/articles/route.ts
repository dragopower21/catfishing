import { prisma } from "@/lib/db";
import { fetchArticle, titleFromUrl } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";
import { getOwnerId } from "@/lib/owner";
import { isAdmin } from "@/lib/admin";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";
import { MAX_ARTICLES_PER_SET } from "@/lib/limits";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "articles-add"), 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { id } = await params;

  const set = await prisma.articleSet.findUnique({
    where: { id },
    select: { id: true, ownerId: true, _count: { select: { articles: true } } },
  });
  if (!set) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }

  const [ownerId, admin] = await Promise.all([getOwnerId(), isAdmin()]);
  if (!admin && (ownerId === null || ownerId !== set.ownerId)) {
    return Response.json(
      { error: "You can only add articles to your own sets." },
      { status: 403 }
    );
  }

  if (set._count.articles >= MAX_ARTICLES_PER_SET) {
    return Response.json(
      {
        error: `This set is full (max ${MAX_ARTICLES_PER_SET} articles).`,
      },
      { status: 409 }
    );
  }

  let body: { urlOrTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input =
    typeof body.urlOrTitle === "string"
      ? body.urlOrTitle.trim().slice(0, 500)
      : "";
  if (!input) {
    return Response.json(
      { error: "urlOrTitle is required" },
      { status: 400 }
    );
  }

  const lookupTitle = input.startsWith("http")
    ? titleFromUrl(input) ?? input
    : input;

  let fetched;
  try {
    fetched = await fetchArticle(lookupTitle);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 400 }
    );
  }

  const existing = await prisma.article.findFirst({
    where: { setId: id, wikipediaPageId: fetched.pageId },
    select: { id: true },
  });
  if (existing) {
    return Response.json(
      { error: "This article is already in this set." },
      { status: 409 }
    );
  }

  const filtered = filterCategories(fetched.categories, fetched.title);

  const max = await prisma.article.findFirst({
    where: { setId: id },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const article = await prisma.article.create({
    data: {
      setId: id,
      title: fetched.title,
      wikipediaUrl: fetched.url,
      wikipediaPageId: fetched.pageId,
      categories: JSON.stringify(filtered),
      disabledCategories: JSON.stringify([]),
      customHints: JSON.stringify([]),
      aliases: JSON.stringify(fetched.aliases),
      customAliases: JSON.stringify([]),
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
      pageViews: fetched.pageViews,
      difficultyScore: fetched.difficultyScore,
      orderIndex: (max?.orderIndex ?? -1) + 1,
    },
  });

  await prisma.articleSet.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return Response.json(
    {
      id: article.id,
      setId: article.setId,
      title: article.title,
      wikipediaUrl: article.wikipediaUrl,
      wikipediaPageId: article.wikipediaPageId,
      categories: filtered,
      disabledCategories: [],
      customHints: [],
      aliases: fetched.aliases,
      customAliases: [],
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
      pageViews: fetched.pageViews,
      difficultyScore: fetched.difficultyScore,
      orderIndex: article.orderIndex,
      createdAt: article.createdAt,
    },
    { status: 201 }
  );
}
