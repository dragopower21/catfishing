import { prisma } from "@/lib/db";

export async function GET() {
  const sets = await prisma.articleSet.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { articles: true } },
      plays: {
        orderBy: { finishedAt: "desc" },
        take: 1,
        select: { finishedAt: true },
      },
    },
  });

  const shaped = sets.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    articleCount: s._count.articles,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastPlayedAt: s.plays[0]?.finishedAt ?? null,
  }));
  return Response.json(shaped);
}

export async function POST(request: Request) {
  let body: { name?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "Set name is required" }, { status: 400 });
  }
  const description =
    typeof body.description === "string" ? body.description.trim() : null;

  const set = await prisma.articleSet.create({
    data: { name, description: description || null },
  });
  return Response.json(set, { status: 201 });
}
