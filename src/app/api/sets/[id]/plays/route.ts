import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const set = await prisma.articleSet.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!set) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }
  const plays = await prisma.playSession.findMany({
    where: { setId: id },
    orderBy: { finishedAt: "desc" },
  });
  return Response.json(
    plays.map((p) => ({
      id: p.id,
      setId: p.setId,
      players: JSON.parse(p.players) as string[],
      results: JSON.parse(p.results),
      finishedAt: p.finishedAt,
    }))
  );
}
