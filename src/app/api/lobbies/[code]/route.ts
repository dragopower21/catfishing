import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/owner";
import { isValidLobbyCode, normalizeLobbyCode } from "@/lib/lobbyCodes";
import {
  publicRoundView,
  revealRoundView,
  tickLobby,
} from "@/lib/lobbyFlow";
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
      .sort((a, b) => b.score - a.score)
      .map((m) => ({ id: m.id, displayName: m.displayName, score: m.score }));
  }

  const state: LobbyState = {
    id: lobby.id,
    code: lobby.code,
    mode: lobby.mode as LobbyMode,
    status: lobby.status as LobbyStatus,
    hasPassword: Boolean(lobby.passwordHash),
    setId: lobby.setId,
    setName,
    roundDuration: lobby.roundDuration,
    totalRounds: lobby.totalRounds,
    currentRoundNumber: lobby.currentRoundNumber,
    memberCount: lobby.members.length,
    members: lobby.members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      score: m.score,
      isHost: m.isHost,
      isMe: me?.id === m.id,
      joinedAt: m.joinedAt.toISOString(),
    })),
    me: me
      ? {
          id: me.id,
          displayName: me.displayName,
          score: me.score,
          isHost: me.isHost,
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
