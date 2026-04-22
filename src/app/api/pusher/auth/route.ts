import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/owner";
import { pusher } from "@/lib/pusherServer";

/**
 * Pusher presence-channel auth. Only real lobby members can subscribe.
 * Body is form-encoded: `socket_id=...&channel_name=presence-lobby-<CODE>`
 */
export async function POST(request: Request) {
  const p = pusher();
  if (!p) {
    return Response.json(
      { error: "Real-time not configured on this deployment." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "Invalid form body" }, { status: 400 });
  }
  const socketId = form.get("socket_id");
  const channelName = form.get("channel_name");
  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const m = channelName.match(/^presence-lobby-([A-Z0-9]{4,10})$/);
  if (!m) {
    return Response.json({ error: "Unknown channel" }, { status: 403 });
  }
  const code = m[1];

  const ownerId = await getOwnerId();
  if (!ownerId) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const member = await prisma.lobbyMember.findFirst({
    where: { userId: ownerId, lobby: { code } },
    select: { id: true, displayName: true, isHost: true, score: true },
  });
  if (!member) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const auth = p.authorizeChannel(socketId, channelName, {
    user_id: member.id,
    user_info: {
      displayName: member.displayName,
      isHost: member.isHost,
      score: member.score,
    },
  });
  return Response.json(auth);
}
