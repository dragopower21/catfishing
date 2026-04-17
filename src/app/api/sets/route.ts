import { prisma } from "@/lib/db";
import { ensureOwnerId, getOwnerId } from "@/lib/owner";
import { isAdmin } from "@/lib/admin";
import { clampString, MAX_DESCRIPTION, MAX_NAME, MAX_SETS_PER_OWNER } from "@/lib/limits";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

export async function GET() {
  const [sets, ownerId, admin] = await Promise.all([
    prisma.articleSet.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { articles: true } },
        plays: {
          orderBy: { finishedAt: "desc" },
          take: 1,
          select: { finishedAt: true },
        },
      },
    }),
    getOwnerId(),
    isAdmin(),
  ]);

  // Batch-load creator display names.
  const ownerIds = Array.from(new Set(sets.map((s) => s.ownerId)));
  const users = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.displayName ?? null]));

  const shaped = sets.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    articleCount: s._count.articles,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    lastPlayedAt: s.plays[0]?.finishedAt ?? null,
    isMine: ownerId !== null && s.ownerId === ownerId,
    canManage:
      admin || (ownerId !== null && s.ownerId === ownerId),
    creatorName: nameById.get(s.ownerId) ?? null,
  }));
  return Response.json(shaped);
}

export async function POST(request: Request) {
  const rate = checkRate(clientKey(request, "sets-create"), 10, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  let body: { name?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = clampString(body.name, MAX_NAME);
  if (!name) {
    return Response.json({ error: "Set name is required" }, { status: 400 });
  }
  const descTrimmed = clampString(body.description, MAX_DESCRIPTION);

  const ownerId = await ensureOwnerId();

  const existing = await prisma.articleSet.count({ where: { ownerId } });
  if (existing >= MAX_SETS_PER_OWNER) {
    return Response.json(
      {
        error: `You've hit the limit of ${MAX_SETS_PER_OWNER} sets per user. Delete one before creating another.`,
      },
      { status: 429 }
    );
  }

  const set = await prisma.articleSet.create({
    data: {
      name,
      description: descTrimmed || null,
      ownerId,
    },
  });
  return Response.json(set, { status: 201 });
}
