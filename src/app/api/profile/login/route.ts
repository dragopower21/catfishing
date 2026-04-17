import { prisma } from "@/lib/db";
import { replaceOwnerCookie } from "@/lib/owner";
import {
  validateDisplayNameInput,
  validatePasswordInput,
  verifyPassword,
} from "@/lib/password";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

/**
 * Sign in as a password-protected display name. On success, the
 * current browser's cf_owner cookie is replaced with the target user's
 * id — all sets they own now appear under Your sets on this device.
 * The previous owner cookie's sets stay where they were; they just
 * aren't yours anymore on this browser.
 */
export async function POST(request: Request) {
  const rate = checkRate(clientKey(request, "profile-login"), 10, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  let body: { displayName?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = validateDisplayNameInput(body.displayName);
  const password = validatePasswordInput(body.password);
  if (!name || !password) {
    return Response.json(
      { error: "Display name and password are required." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { displayName: name },
  });
  if (!user) {
    return Response.json(
      { error: "No account found with that name." },
      { status: 401 }
    );
  }
  if (!user.passwordHash) {
    return Response.json(
      {
        error:
          "That name has no password. Guest names can't be signed into from another device — open the original device, set a password, then try again.",
      },
      { status: 401 }
    );
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }

  await replaceOwnerCookie(user.id);
  return Response.json({
    id: user.id,
    displayName: user.displayName,
    hasPassword: true,
  });
}
