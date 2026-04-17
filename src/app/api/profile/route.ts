import { prisma } from "@/lib/db";
import { ensureOwnerId, getOwnerId } from "@/lib/owner";
import {
  hashPassword,
  validateDisplayNameInput,
  validatePasswordInput,
} from "@/lib/password";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

export async function GET() {
  const ownerId = await getOwnerId();
  if (!ownerId) {
    return Response.json({
      id: null,
      displayName: null,
      hasPassword: false,
    });
  }
  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) {
    return Response.json({
      id: null,
      displayName: null,
      hasPassword: false,
    });
  }
  return Response.json({
    id: user.id,
    displayName: user.displayName,
    hasPassword: Boolean(user.passwordHash),
  });
}

/**
 * Set or update the current user's display name, and optionally set a
 * password that locks the name to whichever browser knows it.
 *
 * Body:
 *   { displayName: string, password?: string, removePassword?: boolean }
 *
 * - If the name is taken by another user, rejects.
 * - If the name is taken by you (same owner cookie), you can rename it
 *   and/or change your password.
 */
export async function PATCH(request: Request) {
  const rate = checkRate(clientKey(request, "profile-update"), 10, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  let body: {
    displayName?: unknown;
    password?: unknown;
    removePassword?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = validateDisplayNameInput(body.displayName);
  if (!name) {
    return Response.json(
      {
        error:
          "Display name must be 2–30 printable ASCII characters (letters, digits, spaces).",
      },
      { status: 400 }
    );
  }

  const ownerId = await ensureOwnerId();

  const existing = await prisma.user.findUnique({
    where: { displayName: name },
  });
  if (existing && existing.id !== ownerId) {
    return Response.json(
      {
        error:
          existing.passwordHash
            ? "That name is claimed with a password. Sign in with the password, or pick another."
            : "That name is already in use. Pick another.",
      },
      { status: 409 }
    );
  }

  const data: {
    displayName: string;
    passwordHash?: string | null;
  } = { displayName: name };

  if (body.removePassword === true) {
    data.passwordHash = null;
  } else if (body.password !== undefined && body.password !== null && body.password !== "") {
    const pw = validatePasswordInput(body.password);
    if (!pw) {
      return Response.json(
        { error: "Password must be 4–200 characters." },
        { status: 400 }
      );
    }
    data.passwordHash = hashPassword(pw);
  }

  const updated = await prisma.user.upsert({
    where: { id: ownerId },
    update: data,
    create: { id: ownerId, ...data },
  });

  return Response.json({
    id: updated.id,
    displayName: updated.displayName,
    hasPassword: Boolean(updated.passwordHash),
  });
}
