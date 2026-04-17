import Link from "next/link";
import {
  Dice5,
  Lightbulb,
  ListChecks,
  Play,
  Plus,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

export const metadata = {
  title: "How to play — Catfishing with Friends",
  description:
    "Build a set, pass the device, guess the article from its categories.",
};

type Step = {
  n: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    n: 1,
    icon: Plus,
    color: "bg-accent-yellow",
    title: "Build a set",
    body: (
      <>
        Hit <strong>Create a set</strong> on the home page, give it a theme
        (Geography, 90s movies, whatever), and start adding Wikipedia
        articles. Paste a URL or search by title — the app filters out
        admin noise and obvious giveaway categories automatically.
      </>
    ),
  },
  {
    n: 2,
    icon: Sparkles,
    color: "bg-accent-green",
    title: "Tune it if you want",
    body: (
      <>
        Expand any article in the set to add <strong>your own hints</strong>{" "}
        (shown as extra clues during play) or{" "}
        <strong>extra accepted answers</strong> (aliases Wikipedia doesn&rsquo;t
        know about). Remove any Wikipedia category that feels too obvious.
      </>
    ),
  },
  {
    n: 3,
    icon: Share2,
    color: "bg-accent-pink",
    title: "Share it",
    body: (
      <>
        Tap the share icon on any set to copy its link. Send it to friends —
        they can play on their own device without signing up.
      </>
    ),
  },
  {
    n: 4,
    icon: Play,
    color: "bg-accent-sky",
    title: "Play",
    body: (
      <>
        Each round shows every category for one article. Type what you
        think the article is. Exact match and close matches both count;
        close calls let you self-adjudicate with a{" "}
        <strong>Close enough</strong> button on the results screen.
      </>
    ),
  },
  {
    n: 5,
    icon: Trophy,
    color: "bg-accent-lavender",
    title: "See how you did",
    body: (
      <>
        At the end you get a percentage score, a per-article recap, and a
        shareable emoji string you can paste into group chat.
      </>
    ),
  },
];

const TIPS = [
  {
    icon: Users,
    text: "Pass-and-play — one device, one person at a time. No turns are enforced; take turns however you like.",
  },
  {
    icon: Dice5,
    text: "Use Quick Random on the home page to pull a few articles from every set in the database for a grab-bag round.",
  },
  {
    icon: Lightbulb,
    text: "Spelling mistakes, missing articles like 'the', and partial matches usually count. If you typed something close but got rejected, use Close enough.",
  },
  {
    icon: ListChecks,
    text: "Green-highlighted hints are hints the creator wrote themselves. They're usually your best clue.",
  },
];

export default function HowToPlayPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-10">
        <span className="brut-sticker bg-accent-sky text-slate-900">
          How to play
        </span>
        <h1 className="mt-4 font-display text-5xl leading-[0.95] text-slate-900 sm:text-6xl">
          Guess the article.
        </h1>
        <p className="mt-3 max-w-xl text-base font-medium text-slate-700">
          You see a list of Wikipedia categories. You try to guess what
          article they belong to. That&rsquo;s it. Here&rsquo;s the rest.
        </p>
      </header>

      <ol className="space-y-5">
        {STEPS.map((step) => (
          <li key={step.n} className="brut-card bg-white p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border-[3px] border-slate-900 bg-white font-display text-lg text-slate-900">
                  {step.n}
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border-[3px] border-slate-900 brut-shadow-sm ${step.color}`}
                >
                  <step.icon
                    className="h-5 w-5 text-slate-900"
                    strokeWidth={2.5}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-2xl text-slate-900">
                  {step.title}
                </div>
                <p className="mt-2 text-slate-800">{step.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="brut-card mt-8 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-slate-900">Tips</h2>
        <ul className="mt-4 space-y-3">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[2.5px] border-slate-900 bg-paper">
                <tip.icon
                  className="h-4 w-4 text-slate-900"
                  strokeWidth={2.5}
                />
              </div>
              <p className="text-sm text-slate-800 sm:text-base">{tip.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/sets/new"
          className="brut-btn bg-accent-yellow text-slate-900"
        >
          <Plus className="h-4 w-4" strokeWidth={3} /> Create your first set
        </Link>
        <Link href="/" className="brut-btn bg-white text-slate-900">
          Back to home
        </Link>
      </section>
    </main>
  );
}
