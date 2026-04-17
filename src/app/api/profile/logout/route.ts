import { cookies } from "next/headers";

export async function POST() {
  const jar = await cookies();
  jar.set("cf_owner", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return Response.json({ ok: true });
}
