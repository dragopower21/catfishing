import { prisma } from "@/lib/db";
import { ensureOwnerId } from "@/lib/owner";
import { hashPassword, validatePasswordInput } from "@/lib/password";
import { generateLobbyCode } from "@/lib/lobbyCodes";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";
import type { LobbyMode } from "@/lib/types";

const ALLOWED_ROUND_DURATIONS = new Set([30, 45, 60, 80, 90, 120, 180]);

export async function POST(request: Request) {
  const rate = checkRate(clientKey(request, "lobby-create"), 5, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  let body: {
    mode?: unknown;
    setId?: unknown;
    password?: unknown;
    displayName?: unknown;
    roundDuration?: unknown;
    totalRounds?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode: LobbyMode =
    body.mode === "SET_BASED" ? "SET_BASED" : "FREESTYLE";
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

  let setId: string | null = null;
  if (mode === "SET_BASED") {
    if (typeof body.setId !== "string" || !body.setId) {
      return Response.json(
        { error: "setId is required for SET_BASED mode" },
        { status: 400 }
      );
    }
    const set = await prisma.articleSet.findUnique({
      where: { id: body.setId },
      select: { id: true, hidden: true },
    });
    if (!set || set.hidden) {
      return Response.json({ error: "Set not found" }, { status: 404 });
    }
    setId = set.id;
  }

  let passwordHash: string | null = null;
  if (body.password !== undefined && body.password !== null && body.password !== "") {
    const pw = validatePasswordInput(body.password);
    if (!pw) {
      return Response.json(
        { error: "Password must be 4–200 characters." },
        { status: 400 }
      );
    }
    passwordHash = hashPassword(pw);
  }

  const roundDuration =
    typeof body.roundDuration === "number" &&
    ALLOWED_ROUND_DURATIONS.has(body.roundDuration)
      ? body.roundDuration
      : mode === "FREESTYLE"
        ? 80
        : 60;
  const totalRounds =
    typeof body.totalRounds === "number" &&
    body.totalRounds >= 1 &&
    body.totalRounds <= 30
      ? body.totalRounds
      : 8;

  const ownerId = await ensureOwnerId();

  // Generate a unique code with retry.
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateLobbyCode();
    const exists = await prisma.lobby.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return Response.json(
      { error: "Failed to generate lobby code; try again" },
      { status: 500 }
    );
  }

  const lobby = await prisma.lobby.create({
    data: {
      code,
      mode,
      setId,
      passwordHash,
      roundDuration,
      totalRounds,
      members: {
        create: {
          userId: ownerId,
          displayName,
          isHost: true,
        },
      },
    },
    include: { members: true },
  });

  return Response.json(
    {
      code: lobby.code,
      lobbyId: lobby.id,
      mode: lobby.mode,
      hasPassword: Boolean(lobby.passwordHash),
    },
    { status: 201 }
  );
}
