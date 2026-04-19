import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/owner";
import { isAdmin } from "@/lib/admin";
import { clampString, MAX_DESCRIPTION, MAX_NAME } from "@/lib/limits";

type Ctx = { params: Promise<{ id: string }> };

async function authorize(setId: string): Promise<
  | { ok: true; ownerId: string | null; admin: boolean; setOwnerId: string }
  | { ok: false; status: number; error: string }
> {
  const set = await prisma.articleSet.findUnique({
    where: { id: setId },
    select: { ownerId: true },
  });
  if (!set) return { ok: false, status: 404, error: "Set not found" };
  const [ownerId, admin] = await Promise.all([getOwnerId(), isAdmin()]);
  if (!admin && (ownerId === null || ownerId !== set.ownerId)) {
    return {
      ok: false,
      status: 403,
      error: "You don't own this set.",
    };
  }
  return { ok: true, ownerId, admin, setOwnerId: set.ownerId };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const set = await prisma.articleSet.findUnique({
    where: { id },
    include: { articles: { orderBy: { orderIndex: "asc" } } },
  });
  if (!set) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
  const [ownerId, admin, owner] = await Promise.all([
    getOwnerId(),
    isAdmin(),
    prisma.user.findUnique({
      where: { id: set.ownerId },
      select: { displayName: true },
    }),
  ]);
  const isMine = ownerId !== null && set.ownerId === ownerId;
  if (set.hidden && !admin && !isMine) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
  const articles = set.articles.map((a) => ({
    id: a.id,
    setId: a.setId,
    title: a.title,
    wikipediaUrl: a.wikipediaUrl,
    wikipediaPageId: a.wikipediaPageId,
    categories: JSON.parse(a.categories) as string[],
    disabledCategories: JSON.parse(a.disabledCategories) as string[],
    customHints: JSON.parse(a.customHints) as string[],
    aliases: JSON.parse(a.aliases) as string[],
    customAliases: JSON.parse(a.customAliases) as string[],
    summary: a.summary,
    thumbnailUrl: a.thumbnailUrl,
    orderIndex: a.orderIndex,
    createdAt: a.createdAt,
  }));
  return Response.json({
    id: set.id,
    name: set.name,
    description: set.description,
    hidden: set.hidden,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    isMine,
    canManage: admin || isMine,
    creatorName: owner?.displayName ?? null,
    articles,
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    name?: unknown;
    description?: unknown;
    hidden?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: {
    name?: string;
    description?: string | null;
    hidden?: boolean;
  } = {};
  if (body.name !== undefined) {
    const n = clampString(body.name, MAX_NAME);
    if (!n) {
      return Response.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    data.name = n;
  }
  if (body.description !== undefined) {
    const d = clampString(body.description, MAX_DESCRIPTION);
    data.description = d || null;
  }
  if (body.hidden !== undefined) {
    if (typeof body.hidden !== "boolean") {
      return Response.json(
        { error: "hidden must be a boolean" },
        { status: 400 }
      );
    }
    data.hidden = body.hidden;
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.articleSet.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorize(id);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await prisma.articleSet.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
}
