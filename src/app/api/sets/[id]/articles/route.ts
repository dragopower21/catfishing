import { prisma } from "@/lib/db";
import { fetchArticle, titleFromUrl } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;

  const set = await prisma.articleSet.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!set) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }

  let body: { urlOrTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input =
    typeof body.urlOrTitle === "string" ? body.urlOrTitle.trim() : "";
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
      customHints: JSON.stringify([]),
      aliases: JSON.stringify(fetched.aliases),
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
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
      customHints: [],
      aliases: fetched.aliases,
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
      orderIndex: article.orderIndex,
      createdAt: article.createdAt,
    },
    { status: 201 }
  );
}
