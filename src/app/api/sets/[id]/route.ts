import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const set = await prisma.articleSet.findUnique({
    where: { id },
    include: {
      articles: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!set) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
  const articles = set.articles.map((a) => ({
    id: a.id,
    setId: a.setId,
    title: a.title,
    wikipediaUrl: a.wikipediaUrl,
    wikipediaPageId: a.wikipediaPageId,
    categories: JSON.parse(a.categories) as string[],
    customHints: JSON.parse(a.customHints) as string[],
    aliases: JSON.parse(a.aliases) as string[],
    summary: a.summary,
    thumbnailUrl: a.thumbnailUrl,
    orderIndex: a.orderIndex,
    createdAt: a.createdAt,
  }));
  return Response.json({
    id: set.id,
    name: set.name,
    description: set.description,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    articles,
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { name?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { name?: string; description?: string | null } = {};
  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n) {
      return Response.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    data.name = n;
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  } else if (body.description === null) {
    data.description = null;
  }

  try {
    const updated = await prisma.articleSet.update({ where: { id }, data });
    return Response.json(updated);
  } catch {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.articleSet.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
}
