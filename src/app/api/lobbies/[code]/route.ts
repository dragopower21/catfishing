import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/owner";
import { isValidLobbyCode, normalizeLobbyCode } from "@/lib/lobbyCodes";
import {
  publicRoundView,
  revealRoundView,
  tickLobby,
} from "@/lib/lobbyFlow";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";
import type {
  LobbyMode,
  LobbyState,
  LobbyStatus,
} from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code)) {
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });
  }

  // Opportunistic catch-up on stalled rounds/advances.
  await tickLobby(code);

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    include: {
      members: { orderBy: { joinedAt: "asc" } },
      rounds: { orderBy: { roundNumber: "desc" }, take: 1 },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 60,
        select: {
          id: true,
          memberId: true,
          displayName: true,
          text: true,
          type: true,
          points: true,
          roundId: true,
          createdAt: true,
        },
      },
    },
  });
  if (!lobby) {
    return Response.json({ error: "Lobby not found" }, { status: 404 });
  }

  const ownerId = await getOwnerId();
  const me = ownerId
    ? lobby.members.find((m) => m.userId === ownerId) ?? null
    : null;
  const isPlayer = (m: { isHost: boolean }) =>
    lobby.hostIsPlayer || !m.isHost;

  let setName: string | null = null;
  if (lobby.setId) {
    const s = await prisma.articleSet.findUnique({
      where: { id: lobby.setId },
      select: { name: true },
    });
    setName = s?.name ?? null;
  }

  const currentRound = lobby.rounds[0] ?? null;
  // If the current round is ENDED, we also want to keep a reveal view handy.
  const lastReveal =
    currentRound && currentRound.status === "ENDED"
      ? revealRoundView(currentRound)
      : null;

  let pickerInfo: { id: string; displayName: string } | null = null;
  if (currentRound?.pickerMemberId) {
    const p = lobby.members.find((m) => m.id === currentRound.pickerMemberId);
    if (p) pickerInfo = { id: p.id, displayName: p.displayName };
  }

  let finalScores:
    | Array<{ id: string; displayName: string; score: number }>
    | null = null;
  if (lobby.status === "ENDED") {
    finalScores = [...lobby.members]
      .filter(isPlayer)
      .sort((a, b) => b.score - a.score)
      .map((m) => ({ id: m.id, displayName: m.displayName, score: m.score }));
  }

  const state: LobbyState = {
    id: lobby.id,
    code: lobby.code,
    mode: lobby.mode as LobbyMode,
    status: lobby.status as LobbyStatus,
    hasPassword: Boolean(lobby.passwordHash),
    hostIsPlayer: lobby.hostIsPlayer,
    setId: lobby.setId,
    setName,
    roundDuration: lobby.roundDuration,
    totalRounds: lobby.totalRounds,
    currentRoundNumber: lobby.currentRoundNumber,
    memberCount: lobby.members.length,
    activePlayerCount: lobby.members.filter(isPlayer).length,
    members: lobby.members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      score: m.score,
      isHost: m.isHost,
      isPlayer: isPlayer(m),
      isMe: me?.id === m.id,
      joinedAt: m.joinedAt.toISOString(),
    })),
    me: me
      ? {
          id: me.id,
          displayName: me.displayName,
          score: me.score,
          isHost: me.isHost,
          isPlayer: isPlayer(me),
          isMe: true,
          joinedAt: me.joinedAt.toISOString(),
        }
      : null,
    currentRound: currentRound ? publicRoundView(currentRound) : null,
    lastReveal,
    messages: lobby.messages
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        memberId: m.memberId,
        displayName: m.displayName,
        text: m.text,
        type: m.type as "CHAT" | "SYSTEM" | "CORRECT_GUESS",
        points: m.points,
        roundId: m.roundId,
        createdAt: m.createdAt.toISOString(),
      })),
    picker: pickerInfo,
    finalScores,
  };

  return Response.json(state);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "lobby-settings"), 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code)) {
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });
  }

  let body: { hostIsPlayer?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.hostIsPlayer !== "boolean") {
    return Response.json(
      { error: "hostIsPlayer must be a boolean" },
      { status: 400 }
    );
  }

  const ownerId = await getOwnerId();
  if (!ownerId) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    include: { members: true },
  });
  if (!lobby) {
    return Response.json({ error: "Lobby not found" }, { status: 404 });
  }
  const me = lobby.members.find((m) => m.userId === ownerId);
  if (!me || !me.isHost) {
    return Response.json(
      { error: "Only the host can update lobby settings." },
      { status: 403 }
    );
  }
  if (lobby.status !== "WAITING") {
    return Response.json(
      { error: "Lobby settings can only be changed before the game starts." },
      { status: 409 }
    );
  }

  const updated = await prisma.lobby.update({
    where: { id: lobby.id },
    data: { hostIsPlayer: body.hostIsPlayer },
  });

  return Response.json({
    ok: true,
    hostIsPlayer: updated.hostIsPlayer,
  });
}
