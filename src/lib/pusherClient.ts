"use client";

import PusherClient from "pusher-js";

let cached: PusherClient | null = null;

export function pusherClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  );
}

export function getPusherClient(): PusherClient | null {
  if (!pusherClientConfigured()) return null;
  if (cached) return cached;
  cached = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: "/api/pusher/auth",
  });
  return cached;
}

export function lobbyChannelName(code: string): string {
  return `presence-lobby-${code.toUpperCase()}`;
}
