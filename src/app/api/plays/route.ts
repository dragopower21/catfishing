import { prisma } from "@/lib/db";
import {
  clampString,
  MAX_GUESS,
  MAX_PLAYER_NAME,
  MAX_PLAYERS,
  MAX_RESULTS,
} from "@/lib/limits";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type RawResult = {
  articleId?: unknown;
  guesserName?: unknown;
  guessText?: unknown;
  correct?: unknown;
  skipped?: unknown;
};

export async function POST(request: Request) {
  const rate = checkRate(clientKey(request, "plays"), 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  let body: { setId?: unknown; players?: unknown; results?: unknown };
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

  const players = body.players
    .slice(0, MAX_PLAYERS)
    .map((p) => clampString(p, MAX_PLAYER_NAME))
    .filter(Boolean);
  if (players.length === 0) {
    return Response.json(
      { error: "players must contain at least one name" },
      { status: 400 }
    );
  }

  const results = (body.results as RawResult[])
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      articleId: typeof r.articleId === "string" ? r.articleId.slice(0, 50) : "",
      guesserName: clampString(r.guesserName, MAX_PLAYER_NAME),
      guessText: clampString(r.guessText, MAX_GUESS),
      correct: Boolean(r.correct),
      skipped: Boolean(r.skipped),
    }));

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
