"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  ThumbsUp,
  X,
} from "lucide-react";
import CategoryList from "@/components/CategoryList";
import GuessInput from "@/components/GuessInput";
import { matchGuess } from "@/lib/matchGuess";
import type { ArticleDTO, PlayResultEntry, SetDetail } from "@/lib/types";

type Phase =
  | { kind: "input" }
  | {
      kind: "feedback";
      verdict: "EXACT" | "CLOSE" | "WRONG" | "SKIP";
      guess: string;
    };

export default function PlayPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = use(params);
  const isRandom = setId === "random";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setName, setSetName] = useState<string>("Random");
  const [realSetId, setRealSetId] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleDTO[]>([]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [results, setResults] = useState<PlayResultEntry[]>([]);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        let loadedArticles: ArticleDTO[] = [];
        if (isRandom) {
          const raw = sessionStorage.getItem("catfishing:random");
          if (!raw) {
            setLoadError(
              "No random game prepared. Go back to the dashboard and start one."
            );
            return;
          }
          const parsed = JSON.parse(raw) as { articles: ArticleDTO[] };
          if (!parsed.articles || parsed.articles.length === 0) {
            setLoadError("No articles available for random play.");
            return;
          }
          loadedArticles = parsed.articles;
          setArticles(loadedArticles);
          setSetName("Quick Random");
          setRealSetId(null);
        } else {
          const res = await fetch(`/api/sets/${setId}`);
          if (!res.ok) {
            setLoadError("Set not found");
            return;
          }
          const detail = (await res.json()) as SetDetail;
          if (detail.articles.length === 0) {
            setLoadError("This set has no articles yet.");
            return;
          }
          loadedArticles = detail.articles;
          setArticles(loadedArticles);
          setSetName(detail.name);
          setRealSetId(detail.id);
        }

        const needsRefresh = loadedArticles.filter(
          (a) => a.summary === null && a.thumbnailUrl === null
        );
        if (needsRefresh.length > 0) {
          const updates = await Promise.all(
            needsRefresh.map(async (a) => {
              try {
                const res = await fetch(
                  `/api/articles/${a.id}/refresh-media`,
                  { method: "POST" }
                );
                if (!res.ok) return null;
                return (await res.json()) as {
                  id: string;
                  summary: string | null;
                  thumbnailUrl: string | null;
                };
              } catch {
                return null;
              }
            })
          );
          const byId = new Map(
            updates
              .filter((u): u is NonNullable<typeof u> => !!u)
              .map((u) => [u.id, u])
          );
          if (byId.size > 0) {
            setArticles((prev) =>
              prev.map((a) => {
                const u = byId.get(a.id);
                return u
                  ? { ...a, summary: u.summary, thumbnailUrl: u.thumbnailUrl }
                  : a;
              })
            );
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [setId, isRandom]);

  useEffect(() => {
    if (articles.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [articles.length]);

  const article = articles[currentIdx];
  const sortedCategories = useMemo(
    () =>
      article
        ? [...article.categories].sort((a, b) => a.localeCompare(b))
        : [],
    [article]
  );

  const correctCount = results.filter((r) => r.correct).length;

  function recordResult(
    verdict: "EXACT" | "CLOSE" | "WRONG" | "SKIP",
    guess: string,
    skipped: boolean
  ) {
    if (!article) return;
    const correct = verdict === "EXACT" || verdict === "CLOSE";
    setResults((prev) => [
      ...prev,
      {
        articleId: article.id,
        guesserName: "You",
        guessText: guess,
        correct,
        skipped,
        verdict,
        articleTitle: article.title,
      },
    ]);
    setPhase({ kind: "feedback", verdict, guess });
    if (correct && typeof window !== "undefined") {
      import("canvas-confetti")
        .then(({ default: confetti }) => {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#FACC15", "#22C55E", "#38BDF8", "#FB7185"],
          });
        })
        .catch(() => {});
    }
  }

  function handleGuess(guess: string) {
    if (!article) return;
    const verdict = matchGuess(guess, {
      title: article.title,
      aliases: article.aliases,
    });
    recordResult(verdict, guess, false);
  }

  function handleSkip() {
    recordResult("SKIP", "", true);
  }

  function markCloseEnough() {
    setResults((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        { ...last, correct: true, skipped: false, verdict: "CLOSE" },
      ];
    });
    setPhase((p) =>
      p.kind === "feedback" ? { ...p, verdict: "CLOSE" } : p
    );
    if (typeof window !== "undefined") {
      import("canvas-confetti")
        .then(({ default: confetti }) => {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ["#FACC15", "#22C55E"],
          });
        })
        .catch(() => {});
    }
  }

  function handleNext() {
    if (currentIdx + 1 >= articles.length) {
      finishGame();
      return;
    }
    setCurrentIdx((i) => i + 1);
    setPhase({ kind: "input" });
  }

  const finishGame = useCallback(async () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    const snapshot = {
      setName,
      setId: realSetId ?? undefined,
      results,
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        wikipediaUrl: a.wikipediaUrl,
      })),
    };

    if (realSetId) {
      try {
        await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setId: realSetId,
            players: ["You"],
            results: results.map((r) => ({
              articleId: r.articleId,
              guesserName: r.guesserName,
              guessText: r.guessText,
              correct: r.correct,
              skipped: r.skipped,
            })),
          }),
        });
      } catch {
        // non-fatal
      }
    }

    sessionStorage.setItem("catfishing:lastPlay", JSON.stringify(snapshot));
    router.push("/play/results");
  }, [articles, realSetId, results, router, setName]);

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />{" "}
          Loading…
        </div>
      </main>
    );
  }
  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Link
          href="/"
          className="brut-btn brut-btn-sm bg-white text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
        </Link>
        <div className="brut-card mt-6 bg-accent-red/20 p-4 text-sm font-bold text-slate-900">
          {loadError}
        </div>
      </main>
    );
  }

  if (!article) return null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="brut-btn brut-btn-sm bg-white text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Quit
        </Link>
        <div className="flex items-center gap-2">
          <span className="brut-pill bg-white text-slate-900">
            {currentIdx + 1} / {articles.length}
          </span>
          <span className="brut-pill bg-accent-green text-slate-900">
            {correctCount} correct
          </span>
        </div>
        <span className="hidden text-xs font-extrabold uppercase tracking-widest text-slate-600 sm:inline">
          {setName}
        </span>
      </header>

      {phase.kind === "input" && (
        <section
          className="brut-card animate-slide-in bg-white p-6 sm:p-8"
          key={`card-${currentIdx}`}
        >
          <CategoryList
            categories={sortedCategories}
            customHints={article.customHints}
          />
          <GuessInput
            onSubmit={handleGuess}
            onSkip={handleSkip}
            resetKey={currentIdx}
          />
        </section>
      )}

      {phase.kind === "feedback" && (
        <FeedbackScreen
          verdict={phase.verdict}
          guess={phase.guess}
          article={article}
          categories={sortedCategories}
          onNext={handleNext}
          onCloseEnough={markCloseEnough}
          isLast={currentIdx + 1 >= articles.length}
        />
      )}
    </main>
  );
}

function FeedbackScreen({
  verdict,
  guess,
  article,
  categories,
  onNext,
  onCloseEnough,
  isLast,
}: {
  verdict: "EXACT" | "CLOSE" | "WRONG" | "SKIP";
  guess: string;
  article: ArticleDTO;
  categories: string[];
  onNext: () => void;
  onCloseEnough: () => void;
  isLast: boolean;
}) {
  const correct = verdict === "EXACT" || verdict === "CLOSE";
  const bannerBg = correct ? "bg-accent-green" : "bg-accent-red";
  const Icon = correct ? Check : X;
  const label = correct
    ? verdict === "CLOSE"
      ? "Close enough!"
      : "Correct!"
    : verdict === "SKIP"
      ? "Skipped"
      : "Not quite";

  return (
    <section className="brut-card animate-pop-in overflow-hidden p-0">
      <div
        className={`flex items-center gap-4 border-b-[3px] border-slate-900 px-6 py-5 ${bannerBg}`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-slate-900 bg-white">
          <Icon className="h-6 w-6 text-slate-900" strokeWidth={3.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-900">
            {label}
          </div>
          <div className="truncate font-display text-3xl text-slate-900 sm:text-4xl">
            {article.title}
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row">
          {article.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.thumbnailUrl}
              alt={article.title}
              className="h-56 w-full shrink-0 rounded-lg border-[3px] border-slate-900 object-cover sm:h-auto sm:w-60"
            />
          )}
          <div className="min-w-0 flex-1">
            {article.summary ? (
              <p className="text-[15px] leading-relaxed text-slate-800">
                {article.summary}
              </p>
            ) : (
              <p className="text-sm italic text-slate-500">
                No description available.
              </p>
            )}
            <a
              href={article.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="brut-btn brut-btn-sm mt-4 inline-flex bg-white text-slate-900"
            >
              Open Wikipedia <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} />
            </a>
          </div>
        </div>

        {guess && (
          <div className="mt-6 rounded-lg border-[2.5px] border-slate-900 bg-paper px-4 py-3 text-sm font-semibold text-slate-800">
            You guessed{" "}
            <span className="font-extrabold">&ldquo;{guess}&rdquo;</span>
          </div>
        )}

        {(categories.length > 0 || article.customHints.length > 0) && (
          <div className="mt-6 border-t-[3px] border-slate-900 pt-5">
            <CategoryList
              categories={categories}
              customHints={article.customHints}
              stickerLabel="Hints"
            />
          </div>
        )}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          {!correct && (
            <button
              type="button"
              onClick={onCloseEnough}
              className="brut-btn flex-1 bg-accent-yellow text-slate-900"
            >
              <ThumbsUp className="h-4 w-4" strokeWidth={3} /> Close enough
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="brut-btn flex-1 bg-accent-sky text-slate-900"
          >
            {isLast ? "See results" : "Next article →"}
          </button>
        </div>
      </div>
    </section>
  );
}
