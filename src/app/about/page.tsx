import Link from "next/link";
import { Cat, ExternalLink, Fish, Sparkles } from "lucide-react";

export const metadata = {
  title: "About — Catfishing with Friends",
  description: "What is Catfishing with Friends?",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <span className="brut-sticker bg-accent-lavender text-slate-900">
          About
        </span>
        <h1 className="mt-4 font-display text-5xl leading-[0.95] text-slate-900 sm:text-6xl">
          We have Catfishing at Home
        </h1>
        <p className="mt-3 text-base font-medium text-slate-700">
          A pass-and-play Wikipedia guessing game for you and your friends —
          build themed sets of articles, then take turns guessing each one
          from its categories alone.
        </p>
      </header>

      <section className="brut-card bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-accent-pink brut-shadow-sm">
            <Cat
              className="h-6 w-6 text-slate-900"
              fill="currentColor"
              strokeWidth={2.5}
            />
          </div>
          <h2 className="font-display text-2xl text-slate-900">
            The idea
          </h2>
        </div>
        <p className="mt-4 text-slate-800">
          Every Wikipedia article lives inside a handful of categories — and
          those categories, read as a list, almost describe the article
          without naming it. This game leans on that: pick an article, hide
          its title, show the categories, and make your friends guess.
        </p>
        <p className="mt-3 text-slate-800">
          It&rsquo;s a clone of{" "}
          <a
            href="https://catfishing.net"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline decoration-[2px] underline-offset-2 hover:text-accent-red"
          >
            catfishing.net
          </a>
          , reworked so you can build your own sets instead of playing a
          daily puzzle. Share a set URL and anyone can play on their own
          device.
        </p>
      </section>

      <section className="brut-card mt-6 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-accent-sky brut-shadow-sm">
            <Sparkles className="h-6 w-6 text-slate-900" strokeWidth={2.5} />
          </div>
          <h2 className="font-display text-2xl text-slate-900">
            What makes it work
          </h2>
        </div>
        <ul className="mt-4 space-y-2 text-slate-800">
          <li>
            <strong>Auto category filter</strong> — admin noise and dead
            giveaways (anything containing a word from the title) get
            stripped before you see them.
          </li>
          <li>
            <strong>Your own hints + aliases</strong> — bolt on extra clues
            the Wikipedia editors never wrote, or accept obvious
            nicknames as correct answers.
          </li>
          <li>
            <strong>Forgiving matching</strong> — spelling slips, partial
            word matches, and close variants count.
          </li>
          <li>
            <strong>No accounts, no logins</strong> — an HttpOnly cookie
            silently marks sets you create as yours. Public sets are
            playable by anyone but only editable by their creator.
          </li>
        </ul>
      </section>

      <section className="brut-card mt-6 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-accent-yellow brut-shadow-sm">
            <Fish
              className="h-6 w-6 text-slate-900"
              fill="currentColor"
              strokeWidth={2.5}
            />
          </div>
          <h2 className="font-display text-2xl text-slate-900">
            Under the hood
          </h2>
        </div>
        <p className="mt-4 text-slate-800">
          Next.js 16 (App Router) + React 19 on the frontend. Prisma 7 +
          Postgres on the backend. Wikipedia&rsquo;s open API does the heavy
          lifting for articles, categories, and images. Hosted on Vercel,
          database on Neon, styled with Tailwind v4.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://github.com/dragopower21/catfishing"
            target="_blank"
            rel="noreferrer"
            className="brut-btn bg-white text-slate-900"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2.5} /> Source on GitHub
          </a>
          <Link
            href="/how-to-play"
            className="brut-btn bg-accent-yellow text-slate-900"
          >
            How to play →
          </Link>
        </div>
      </section>
    </main>
  );
}
