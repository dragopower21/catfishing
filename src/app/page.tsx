"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dice5, Plus, BookOpen, Fish, Cat, Loader2 } from "lucide-react";
import SetCard from "@/components/SetCard";
import AdminToggle from "@/components/AdminToggle";
import type { SetSummary } from "@/lib/types";

const ACCENTS = [
  "#FACC15",
  "#FB7185",
  "#38BDF8",
  "#22C55E",
  "#A78BFA",
  "#F97316",
];

export default function DashboardPage() {
  const router = useRouter();
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRandom, setShowRandom] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [randomLoading, setRandomLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sets");
      if (!res.ok) throw new Error("Failed to load sets");
      const data = (await res.json()) as SetSummary[];
      setSets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    const s = sets?.find((x) => x.id === id);
    const ok = confirm(
      `Delete "${s?.name ?? "this set"}"? This can't be undone.`
    );
    if (!ok) return;
    const res = await fetch(`/api/sets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSets((prev) => prev?.filter((x) => x.id !== id) ?? null);
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Delete failed");
    }
  }

  async function startRandom() {
    setRandomLoading(true);
    try {
      const res = await fetch(`/api/sets/random?count=${randomCount}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Failed to build random set");
        return;
      }
      const data = await res.json();
      sessionStorage.setItem(
        "catfishing:random",
        JSON.stringify({ articles: data.articles, count: randomCount })
      );
      router.push("/play/random");
    } finally {
      setRandomLoading(false);
    }
  }

  const mineSets = sets?.filter((s) => s.isMine) ?? [];
  const publicSets = sets?.filter((s) => !s.isMine) ?? [];
  const hasArticles = (sets ?? []).some((s) => s.articleCount > 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-14">
      <header className="mb-10 text-center sm:mb-14">
        <div className="mx-auto inline-flex items-center gap-3 rounded-full border-[3px] border-slate-900 bg-white px-5 py-2 brut-shadow-sm">
          <Cat
            className="h-5 w-5 text-accent-yellow drop-shadow-[1px_1px_0_#0f172a]"
            fill="currentColor"
            strokeWidth={2.5}
          />
          <span className="font-display text-xs uppercase tracking-widest text-slate-900">
            The Wikipedia guessing game
          </span>
          <Fish
            className="h-5 w-5 text-accent-sky drop-shadow-[1px_1px_0_#0f172a]"
            fill="currentColor"
            strokeWidth={2.5}
          />
        </div>
        <h1 className="mt-6 font-display text-6xl leading-[0.95] text-slate-900 sm:text-7xl">
          We have Catfishing at Home
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-slate-700">
          The Wikipedia guessing game, now with friends! Build sets, or try
          out any of the public sets.
        </p>
        <div className="mt-5 flex justify-center">
          <AdminToggle onChange={() => load()} />
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setShowRandom(true)}
          className="brut-card-link flex min-h-44 flex-col justify-between bg-white p-5 text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-accent-pink brut-shadow-sm">
              <Dice5 className="h-7 w-7 text-slate-900" strokeWidth={2.5} />
            </div>
            <span className="brut-sticker bg-accent-pink text-slate-900">
              Fast
            </span>
          </div>
          <div>
            <div className="font-display text-3xl text-slate-900">
              Quick random
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Shuffle articles from every set.
            </div>
          </div>
        </button>

        <Link
          href="/sets/new"
          className="brut-card-link flex min-h-44 flex-col justify-between bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-accent-yellow brut-shadow-sm">
              <Plus className="h-7 w-7 text-slate-900" strokeWidth={3} />
            </div>
            <span className="brut-sticker bg-accent-yellow text-slate-900">
              New
            </span>
          </div>
          <div>
            <div className="font-display text-3xl text-slate-900">
              Create a set
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Pick a theme, add articles.
            </div>
          </div>
        </Link>

        <a
          href={publicSets.length || mineSets.length ? "#your" : undefined}
          className={`brut-card-link flex min-h-44 flex-col justify-between bg-white p-5 ${
            publicSets.length || mineSets.length
              ? "cursor-pointer"
              : "opacity-60 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-accent-sky brut-shadow-sm">
              <BookOpen
                className="h-7 w-7 text-slate-900"
                strokeWidth={2.5}
              />
            </div>
            <span className="brut-sticker bg-accent-sky text-slate-900">
              Play
            </span>
          </div>
          <div>
            <div className="font-display text-3xl text-slate-900">
              Saved sets
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              {publicSets.length + mineSets.length > 0
                ? "Pick one below."
                : "Create one first."}
            </div>
          </div>
        </a>
      </section>

      {error && (
        <div className="brut-card mt-10 bg-accent-red/20 p-4 text-sm font-bold text-slate-900">
          {error}
        </div>
      )}

      {sets === null && !error && (
        <div className="mt-10 flex items-center gap-2 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          Loading sets…
        </div>
      )}

      {sets && (
        <>
          <SetsSection
            id="your"
            title="Your sets"
            emptyHint="Nothing yet. Create your first set above."
            sets={mineSets}
            onDelete={handleDelete}
            accentOffset={0}
          />
          <SetsSection
            id="public"
            title="Public sets"
            emptyHint="No public sets yet. Be the first!"
            sets={publicSets}
            onDelete={handleDelete}
            accentOffset={2}
          />
        </>
      )}

      {showRandom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="brut-card animate-pop-in w-full max-w-sm bg-white p-6">
            <h3 className="font-display text-3xl text-slate-900">
              Quick random
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              How many articles?
            </p>
            <input
              type="number"
              min={3}
              max={20}
              value={randomCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) setRandomCount(n);
              }}
              className="brut-input mt-4 w-full text-lg"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRandom(false)}
                disabled={randomLoading}
                className="brut-btn bg-white text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startRandom}
                disabled={
                  randomLoading ||
                  randomCount < 3 ||
                  randomCount > 20 ||
                  !hasArticles
                }
                className="brut-btn bg-accent-yellow text-slate-900"
              >
                {randomLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                )}
                Start
              </button>
            </div>
            {!hasArticles && (
              <p className="mt-3 text-xs font-bold text-accent-red">
                You need at least one article saved first.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function SetsSection({
  id,
  title,
  emptyHint,
  sets,
  onDelete,
  accentOffset,
}: {
  id: string;
  title: string;
  emptyHint: string;
  sets: SetSummary[];
  onDelete: (id: string) => void;
  accentOffset: number;
}) {
  return (
    <section id={id} className="mt-12">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="font-display text-4xl text-slate-900">{title}</h2>
        <span className="brut-pill bg-white text-slate-900">
          {sets.length} {sets.length === 1 ? "set" : "sets"}
        </span>
      </div>

      {sets.length === 0 ? (
        <div className="brut-card bg-white p-8 text-center text-sm font-semibold text-slate-500">
          {emptyHint}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s, i) => (
            <SetCard
              key={s.id}
              set={s}
              onDelete={onDelete}
              accentColor={
                ACCENTS[(i + accentOffset) % ACCENTS.length]
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
