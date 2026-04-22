import PusherServer from "pusher";

// Lazily created so build-time (no env vars) doesn't throw.
let cached: PusherServer | null = null;

export function pusherConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_SECRET &&
      process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  );
}

export function pusher(): PusherServer | null {
  if (!pusherConfigured()) return null;
  if (cached) return cached;
  cached = new PusherServer({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });
  return cached;
}

export function lobbyChannel(code: string): string {
  // Presence channels give us a live member list for free.
  return `presence-lobby-${code.toUpperCase()}`;
}

/**
 * Fire-and-forget broadcast helper. Swallows errors so a Pusher outage
 * doesn't take out the game — state is still correct in Postgres.
 */
export async function broadcast(
  code: string,
  event: string,
  payload: unknown
): Promise<void> {
  const p = pusher();
  if (!p) return;
  try {
    await p.trigger(lobbyChannel(code), event, payload);
  } catch (err) {
    console.warn("[pusher] broadcast failed:", err);
  }
}
