import { adminConfigured, isAdmin } from "@/lib/admin";

export async function GET() {
  const admin = await isAdmin();
  return Response.json({
    admin,
    configured: adminConfigured(),
  });
}
