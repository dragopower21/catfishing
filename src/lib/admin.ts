import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

const ADMIN_COOKIE = "cf_admin";
const ONE_DAY = 60 * 60 * 24;

function configuredAdminKey(): string | null {
  const k = process.env.ADMIN_KEY;
  if (!k || k.length < 8) return null;
  return k;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a compare to avoid timing leak on length.
    timingSafeEqual(ab, Buffer.alloc(ab.length));
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function verifyAdminKey(candidate: unknown): boolean {
  const configured = configuredAdminKey();
  if (!configured) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  return constantTimeEqual(candidate, configured);
}

export async function isAdmin(): Promise<boolean> {
  const configured = configuredAdminKey();
  if (!configured) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return constantTimeEqual(token, configured);
}

export async function setAdminCookie(): Promise<void> {
  const configured = configuredAdminKey();
  if (!configured) return;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, configured, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_DAY,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function adminConfigured(): boolean {
  return configuredAdminKey() !== null;
}
