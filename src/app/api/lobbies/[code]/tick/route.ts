import { tickLobby } from "@/lib/lobbyFlow";
import {
  isValidLobbyCode,
  normalizeLobbyCode,
} from "@/lib/lobbyCodes";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "lobby-tick"), 120, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code))
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });
  await tickLobby(code);
  return Response.json({ ok: true });
}
