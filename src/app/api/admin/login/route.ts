import {
  adminConfigured,
  setAdminCookie,
  verifyAdminKey,
} from "@/lib/admin";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = checkRate(clientKey(request, "admin-login"), 5, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  if (!adminConfigured()) {
    return Response.json(
      { error: "Admin mode is not configured on this deployment." },
      { status: 503 }
    );
  }

  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!verifyAdminKey(body.key)) {
    return Response.json({ error: "Wrong key." }, { status: 401 });
  }

  await setAdminCookie();
  return Response.json({ admin: true });
}
