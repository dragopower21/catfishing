import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/owner";
import { isAdmin } from "@/lib/admin";
import {
  clampString,
  MAX_CATEGORIES_PER_ARTICLE,
  MAX_CATEGORY,
  MAX_HINT,
  MAX_HINTS_PER_ARTICLE,
} from "@/lib/limits";

type Ctx = { params: Promise<{ id: string }> };

function sanitizeStringArray(
  input: unknown,
  itemMax: number,
  listMax: number
): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") return null;
    const trimmed = clampString(item, itemMax);
    if (trimmed) out.push(trimmed);
  }
  return Array.from(new Set(out)).slice(0, listMax);
}

async function authorizeArticle(articleId: string): Promise<
  | { ok: true; setId: string }
  | { ok: false; status: number; error: string }
> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { setId: true, set: { select: { ownerId: true } } },
  });
  if (!article) return { ok: false, status: 404, error: "Article not found" };
  const [ownerId, admin] = await Promise.all([getOwnerId(), isAdmin()]);
  if (!admin && (ownerId === null || ownerId !== article.set.ownerId)) {
    return {
      ok: false,
      status: 403,
      error: "You can only change articles in your own sets.",
    };
  }
  return { ok: true, setId: article.setId };
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeArticle(id);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: { categories?: unknown; customHints?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { categories?: string; customHints?: string } = {};

  if (body.categories !== undefined) {
    const cats = sanitizeStringArray(
      body.categories,
      MAX_CATEGORY,
      MAX_CATEGORIES_PER_ARTICLE
    );
    if (cats === null) {
      return Response.json(
        { error: "categories must be an array of strings" },
        { status: 400 }
      );
    }
    data.categories = JSON.stringify(cats);
  }
  if (body.customHints !== undefined) {
    const hints = sanitizeStringArray(
      body.customHints,
      MAX_HINT,
      MAX_HINTS_PER_ARTICLE
    );
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

  const article = await prisma.article.update({ where: { id }, data });
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
  const auth = await authorizeArticle(id);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
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
