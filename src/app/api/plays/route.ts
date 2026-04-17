import { prisma } from "@/lib/db";

type PlayResult = {
  articleId: string;
  guesserName: string;
  guessText: string;
  correct: boolean;
  skipped: boolean;
};

export async function POST(request: Request) {
  let body: {
    setId?: unknown;
    players?: unknown;
    results?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const setId = typeof body.setId === "string" ? body.setId : "";
  if (!setId) {
    return Response.json({ error: "setId is required" }, { status: 400 });
  }
  if (!Array.isArray(body.players) || body.players.length === 0) {
    return Response.json(
      { error: "players must be a non-empty array" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.results)) {
    return Response.json(
      { error: "results must be an array" },
      { status: 400 }
    );
  }

  const players = body.players.map(String);
  const results = body.results as PlayResult[];

  const setExists = await prisma.articleSet.findUnique({
    where: { id: setId },
    select: { id: true },
  });
  if (!setExists) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }

  const session = await prisma.playSession.create({
    data: {
      setId,
      players: JSON.stringify(players),
      results: JSON.stringify(results),
    },
  });
  return Response.json({ id: session.id }, { status: 201 });
}
