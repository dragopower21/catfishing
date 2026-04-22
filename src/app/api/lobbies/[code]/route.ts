import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/owner";
import { isValidLobbyCode, normalizeLobbyCode } from "@/lib/lobbyCodes";
import type { LobbyMode, LobbyState, LobbyStatus } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code)) {
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });
  }

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    include: {
      members: { orderBy: { joinedAt: "asc" } },
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
  };

  return Response.json(state);
}
