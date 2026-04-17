// Prisma 7 reads datasource URL from this config (schema.prisma no
// longer carries it). We surface a clear error if it isn't set — the
// default Prisma error is cryptic.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Local dev: add it to .env. Vercel: Storage → Create Database → Postgres (this wires it automatically)."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
