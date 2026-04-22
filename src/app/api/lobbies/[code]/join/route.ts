import { prisma } from "@/lib/db";
import { ensureOwnerId } from "@/lib/owner";
import { verifyPassword } from "@/lib/password";
import {
  isValidLobbyCode,
  normalizeLobbyCode,
} from "@/lib/lobbyCodes";
import { broadcast } from "@/lib/pusherServer";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

const MAX_MEMBERS = 8;

export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "lobby-join"), 20, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code)) {
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });
  }

  let body: { displayName?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim().slice(0, 40)
      : "";
  if (!displayName) {
    return Response.json(
      { error: "Display name is required" },
      { status: 400 }
    );
  }

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    include: { members: true },
  });
  if (!lobby) {
    return Response.json({ error: "Lobby not found" }, { status: 404 });
  }

  if (lobby.status === "ENDED") {
    return Response.json(
      { error: "That lobby has already ended." },
      { status: 410 }
    );
  }

  const ownerId = await ensureOwnerId();
  const existing = lobby.members.find((m) => m.userId === ownerId);

  if (!existing) {
    // Fresh join — capacity + password checks.
    if (lobby.members.length >= MAX_MEMBERS) {
      return Response.json(
        { error: "Lobby is full." },
        { status: 409 }
      );
    }
    if (lobby.passwordHash) {
      const pw =
        typeof body.password === "string" ? body.password : "";
      if (!verifyPassword(pw, lobby.passwordHash)) {
        return Response.json(
          { error: "Wrong lobby password." },
          { status: 401 }
        );
      }
    }
    const dupeName = lobby.members.find(
      (m) => m.displayName.toLowerCase() === displayName.toLowerCase()
    );
    if (dupeName) {
      return Response.json(
        { error: "Someone in this lobby is already using that name." },
        { status: 409 }
      );
    }
  }

  const member = existing
    ? await prisma.lobbyMember.update({
        where: { id: existing.id },
        data: { displayName, lastSeenAt: new Date() },
      })
    : await prisma.lobbyMember.create({
        data: {
          lobbyId: lobby.id,
          userId: ownerId,
          displayName,
        },
      });

  if (!existing) {
    await broadcast(code, "member-joined", {
      id: member.id,
      displayName: member.displayName,
      score: member.score,
      isHost: member.isHost,
      joinedAt: member.joinedAt.toISOString(),
    });
  }

  return Response.json({
    memberId: member.id,
    displayName: member.displayName,
    isHost: member.isHost,
  });
}
