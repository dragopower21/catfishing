# Catfishing with Friends

The Wikipedia guessing game, now with friends! Build sets of themed articles, then take turns guessing each article from its categories alone.

Built with Next.js 16 (App Router) + Prisma 7 + Postgres + Tailwind v4.

## How ownership works (no accounts)

There's no login. The first time you visit, the server sets an HttpOnly cookie (`cf_owner`) that silently marks you as the creator of any set you make.

- **Your sets** — created from this browser. Only you can edit or delete them.
- **Public sets** — everything else. Anyone can play them, but not edit or delete.
- **Admin** — if you set `ADMIN_KEY` (see below), you can unlock deletion on any public set by entering the key once. This is the only way to remove someone else's content.

Ownership is enforced server-side against the HttpOnly cookie; clients can't forge or steal it via the DOM.

## Local development

```bash
npm install
echo 'DATABASE_URL="postgresql://user:pass@host:5432/db"' >> .env
echo 'ADMIN_KEY="pick-a-long-random-string"' >> .env
npm run dev
```

Easiest Postgres: a free [Neon](https://neon.tech) branch or the Vercel Postgres you'll create below. On first run the build pushes the schema automatically.

The dev server binds `0.0.0.0` so anyone on your Wi-Fi can play via the Network URL it prints.

## Deploy on Vercel

1. **Import this repo** in Vercel.
2. **Add a Postgres database:** Project → Storage → Create Database → Postgres. Vercel sets `DATABASE_URL` automatically.
3. **Add `ADMIN_KEY`** under Project Settings → Environment Variables. Pick a long random string; anyone with this key can delete public sets. Keep it private.
4. **Deploy.** The build runs `prisma db push` to create the schema, then builds Next.js.

## Security posture (short version)

- **Ownership** via HttpOnly cookie; server checks on every mutating request. Admin key checked with `timingSafeEqual`.
- **Input caps**: set names 80 chars, descriptions 280, hints 120; 50 sets/owner, 200 articles/set, etc. All strings server-trimmed.
- **Rate limits** (in-memory, per-IP, per-endpoint):
  - Wikipedia search: 60/min · fetch: 30/min
  - Set creation: 10/min · article add: 30/min
  - Play save: 30/min · admin login: 5/min
- **Wikipedia proxy** only hits `en.wikipedia.org`, can't be redirected to arbitrary hosts.
- **Disambiguation pages** are rejected. Pageimages are cached into Postgres so repeated plays don't re-query Wikipedia.

Limitations worth knowing: in-memory rate limits reset on serverless cold starts and don't share across Vercel instances, so this is DoS-resistant for casual abuse but not a hardened defense. For heavier protection, swap `src/lib/rateLimit.ts` for [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted).

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server on `:3000` (binds all interfaces) |
| `npm run build` | Generate client, push schema, `next build` |
| `npm run db:push` | Sync `schema.prisma` to the DB |
| `npm run db:studio` | Open Prisma Studio |
