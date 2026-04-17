import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const OWNER_COOKIE = "cf_owner";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Read the owner cookie, creating one if missing.
 * The cookie is HttpOnly + SameSite=Lax so JS can't read or forge it;
 * this is the durable identity of whoever created a set from this
 * browser.
 */
export async function ensureOwnerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{10,64}$/i.test(existing)) return existing;

  const id = randomUUID();
  jar.set(OWNER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return id;
}

/**
 * Read-only variant — returns the owner cookie if already present,
 * null otherwise. Used by read endpoints that shouldn't mutate state.
 */
export async function getOwnerId(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{10,64}$/i.test(existing)) return existing;
  return null;
}
