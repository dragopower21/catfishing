"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { House, RotateCcw } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { buildShareString } from "@/lib/shareString";
import type { PlayResultEntry } from "@/lib/types";

type PlaySnapshot = {
  setName: string;
  results: PlayResultEntry[];
  articles: Array<{ id: string; title: string; wikipediaUrl: string }>;
  setId?: string;
};

function ratingFor(pct: number): {
  label: string;
  emoji: string;
  bg: string;
} {
  if (pct === 100)
    return { label: "Perfect run!", emoji: "🏆", bg: "bg-accent-yellow" };
  if (pct >= 80)
    return { label: "Excellent", emoji: "🎯", bg: "bg-accent-green" };
  if (pct >= 60) return { label: "Solid", emoji: "😎", bg: "bg-accent-sky" };
  if (pct >= 40)
    return { label: "Not bad", emoji: "🙂", bg: "bg-accent-lavender" };
  if (pct >= 20)
    return { label: "Rough day", emoji: "😅", bg: "bg-accent-pink" };
  return { label: "Catfished hard", emoji: "🐟", bg: "bg-accent-red" };
}

export default function ResultsPage() {
  const [snap, setSnap] = useState<PlaySnapshot | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("catfishing:lastPlay");
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      setSnap(JSON.parse(raw));
    } catch {
      setMissing(true);
    }
  }, []);

  if (missing) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="brut-card bg-white p-6">
          <p className="font-semibold text-slate-600">
            No results to show yet.
          </p>
          <Link
            href="/"
            className="brut-btn mt-4 inline-flex bg-accent-yellow text-slate-900"
          >
            <House className="h-4 w-4" strokeWidth={2.5} /> Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!snap) return null;

  const total = snap.results.length;
  const correct = snap.results.filter((r) => r.correct).length;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const rating = ratingFor(pct);

  const shareString = buildShareString(
    snap.setName,
    snap.results.map((r) => ({ correct: r.correct })),
    pct
  );

  const articleLookup = Object.fromEntries(
    snap.articles.map((a) => [a.id, a])
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <section className="brut-card animate-pop-in overflow-hidden p-0">
        <div
          className={`border-b-[3px] border-slate-900 px-6 py-8 text-center ${rating.bg}`}
        >
          <div className="text-5xl">{rating.emoji}</div>
          <div className="mt-2 text-xs font-extrabold uppercase tracking-widest text-slate-900">
            {snap.setName}
          </div>
          <div className="mt-1 font-display text-7xl leading-none text-slate-900 sm:text-8xl">
            {pct}
            <span className="text-4xl">%</span>
          </div>
          <div className="mt-2 text-base font-extrabold text-slate-900">
            {correct} of {total} correct · {rating.label}
          </div>
        </div>
      </section>

      <section className="brut-card mt-6 bg-white p-5 sm:p-6">
        <h2 className="font-display text-2xl text-slate-900">Recap</h2>
        <ul className="mt-4 space-y-2">
          {snap.results.map((r, i) => {
            const a =
              articleLookup[r.articleId] ??
              (r.articleTitle
                ? { title: r.articleTitle, wikipediaUrl: "#" }
                : null);
            const icon =
              r.verdict === "EXACT"
                ? "✅"
                : r.verdict === "CLOSE"
                  ? "🤔"
                  : r.skipped
                    ? "⏭"
                    : "❌";
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border-[2.5px] border-slate-900 bg-paper/50 px-3 py-2"
              >
                <span className="text-xl">{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg text-slate-900">
                    {a ? a.title : "(unknown)"}
                  </div>
                  {!r.skipped && r.guessText && (
                    <div className="truncate text-xs font-semibold text-slate-500">
                      Your guess: {r.guessText}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="brut-card mt-6 flex flex-wrap items-center justify-between gap-4 bg-white p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl text-slate-900">
            Share result
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs font-semibold text-slate-700">
            {shareString}
          </pre>
        </div>
        <ShareButton text={shareString} />
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        {snap.setId ? (
          <Link
            href={`/play/${snap.setId}`}
            className="brut-btn bg-accent-yellow text-slate-900"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.5} /> Play again
          </Link>
        ) : null}
        <Link
          href="/"
          className="brut-btn bg-white text-slate-900"
        >
          <House className="h-4 w-4" strokeWidth={2.5} /> Dashboard
        </Link>
      </section>
    </main>
  );
}
