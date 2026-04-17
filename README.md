# Catfishing

A pass-and-play Wikipedia category guessing game. Build themed sets of articles, then take turns guessing each article from its categories alone.

Built with Next.js 16 (App Router) + Prisma 7 + Postgres + Tailwind v4.

## Local development

```bash
npm install
echo 'DATABASE_URL="postgresql://user:pass@host:5432/db"' > .env
npm run dev
```

You need a Postgres database. Easiest: a free [Neon](https://neon.tech) branch, or the Vercel Postgres you'll create below (copy the `DATABASE_URL` into `.env`). On first run the build pushes the schema automatically.

Open http://localhost:3000. To expose to your LAN, the dev server already binds `0.0.0.0` — share the Network URL it prints.

## Deploy on Vercel

1. **Import this repo** in the Vercel dashboard.
2. **Add a Postgres database:** Project → Storage → Create Database → Postgres. Vercel sets `DATABASE_URL` as an environment variable automatically.
3. **Deploy.** The build runs `prisma db push` to create the schema, then builds Next.js.

That's it — no migrations to manage for v1. Sets and articles added via the live UI are persisted in Vercel Postgres and visible to anyone with the URL.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server on `:3000` (binds all interfaces) |
| `npm run build` | Generate client, push schema, `next build` |
| `npm run db:push` | Sync `schema.prisma` to the DB (for local schema edits) |
| `npm run db:studio` | Open Prisma Studio |
