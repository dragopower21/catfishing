import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function sanitizeStringArray(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed) out.push(trimmed);
  }
  return Array.from(new Set(out));
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { categories?: unknown; customHints?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { categories?: string; customHints?: string } = {};

  if (body.categories !== undefined) {
    const cats = sanitizeStringArray(body.categories);
    if (cats === null) {
      return Response.json(
        { error: "categories must be an array of strings" },
        { status: 400 }
      );
    }
    data.categories = JSON.stringify(cats);
  }
  if (body.customHints !== undefined) {
    const hints = sanitizeStringArray(body.customHints);
    if (hints === null) {
      return Response.json(
        { error: "customHints must be an array of strings" },
        { status: 400 }
      );
    }
    data.customHints = JSON.stringify(hints);
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  let article;
  try {
    article = await prisma.article.update({ where: { id }, data });
  } catch {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  await prisma.articleSet.update({
    where: { id: article.setId },
    data: { updatedAt: new Date() },
  });

  return Response.json({
    id: article.id,
    setId: article.setId,
    title: article.title,
    wikipediaUrl: article.wikipediaUrl,
    wikipediaPageId: article.wikipediaPageId,
    categories: JSON.parse(article.categories) as string[],
    customHints: JSON.parse(article.customHints) as string[],
    aliases: JSON.parse(article.aliases) as string[],
    summary: article.summary,
    thumbnailUrl: article.thumbnailUrl,
    orderIndex: article.orderIndex,
    createdAt: article.createdAt,
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const deleted = await prisma.article.delete({ where: { id } });
    await prisma.articleSet.update({
      where: { id: deleted.setId },
      data: { updatedAt: new Date() },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }
}
