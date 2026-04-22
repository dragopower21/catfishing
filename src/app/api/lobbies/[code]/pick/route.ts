import { getOwnerId } from "@/lib/owner";
import { FlowError, submitPick } from "@/lib/lobbyFlow";
import {
  isValidLobbyCode,
  normalizeLobbyCode,
} from "@/lib/lobbyCodes";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const rate = checkRate(clientKey(request, "lobby-pick"), 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  const { code: raw } = await params;
  const code = normalizeLobbyCode(raw);
  if (!isValidLobbyCode(code))
    return Response.json({ error: "Invalid lobby code" }, { status: 400 });

  let body: { urlOrTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const urlOrTitle =
    typeof body.urlOrTitle === "string" ? body.urlOrTitle : "";
  if (!urlOrTitle)
    return Response.json(
      { error: "urlOrTitle is required" },
      { status: 400 }
    );

  const ownerId = await getOwnerId();
  if (!ownerId)
    return Response.json({ error: "Not a member" }, { status: 403 });

  try {
    await submitPick(code, ownerId, urlOrTitle);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof FlowError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
