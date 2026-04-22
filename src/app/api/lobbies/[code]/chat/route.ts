import { getOwnerId } from "@/lib/owner";
import { FlowError, submitChat } from "@/lib/lobbyFlow";
import {
  isValidLobbyCode,
  normalizeLobbyCode,
} from "@/lib/lobbyCodes";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "lobby-chat"), 120, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code))
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });

  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";

  const ownerId = await getOwnerId();
  if (!ownerId)
    return Response.json({ error: "Not a member" }, { status: 403 });

  try {
    const verdict = await submitChat(code, ownerId, text);
    return Response.json({ ok: true, verdict });
  } catch (err) {
    if (err instanceof FlowError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
