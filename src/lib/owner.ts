import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

const OWNER_COOKIE = "cf_owner";
const ONE_YEAR = 60 * 60 * 24 * 365;
const ID_RE = /^[0-9a-z][0-9a-z-]{8,63}$/i;

async function setOwnerCookie(id: string) {
  const jar = await cookies();
  jar.set(OWNER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/**
 * Read the owner cookie, creating one if missing. Also lazily creates
 * a User row so every owner has a profile record (displayName/password
 * stay null until the user sets them explicitly).
 */
export async function ensureOwnerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;

  if (existing && ID_RE.test(existing)) {
    await prisma.user.upsert({
      where: { id: existing },
      update: {},
      create: { id: existing },
    });
    return existing;
  }

  const id = randomUUID();
  await setOwnerCookie(id);
  await prisma.user.create({ data: { id } });
  return id;
}

/**
 * Read-only variant — returns the owner cookie if already present,
 * null otherwise. Does not mutate state.
 */
export async function getOwnerId(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing && ID_RE.test(existing)) return existing;
  return null;
}

export async function replaceOwnerCookie(newId: string): Promise<void> {
  await setOwnerCookie(newId);
}
