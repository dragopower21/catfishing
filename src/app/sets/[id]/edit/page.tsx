"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import WikipediaAutocomplete from "@/components/WikipediaAutocomplete";
import ArticlePreview from "@/components/ArticlePreview";
import ArticleRow from "@/components/ArticleRow";
import type {
  ArticleDTO,
  FetchedArticlePreview,
  SetDetail,
} from "@/lib/types";

export default function EditSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<FetchedArticlePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [lastInput, setLastInput] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingHints, setPendingHints] = useState<string[]>([]);
  const [pendingAliases, setPendingAliases] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sets/${id}`);
    if (!res.ok) {
      setError("Set not found.");
      return;
    }
    const d = (await res.json()) as SetDetail;
    if (!d.canManage) {
      setError(
        "You can't edit this set — it was created by someone else. Play it from the dashboard instead."
      );
      return;
    }
    setData(d);
    setNameDraft(d.name);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(urlOrTitle: string) {
    setError(null);
    setFlash(null);
    setPreviewLoading(true);
    setLastInput(urlOrTitle);
    setPendingHints([]);
    setPendingAliases([]);
    try {
      const res = await fetch("/api/wikipedia/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrTitle }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Fetch failed");
        setPreview(null);
        return;
      }
      const p = (await res.json()) as FetchedArticlePreview;
      setPreview(p);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmAdd() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sets/${id}/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrTitle: lastInput || preview.title }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to add article");
        return;
      }
      let article = (await res.json()) as ArticleDTO;
      if (pendingHints.length > 0 || pendingAliases.length > 0) {
        const patchBody: {
          customHints?: string[];
          customAliases?: string[];
        } = {};
        if (pendingHints.length > 0) patchBody.customHints = pendingHints;
        if (pendingAliases.length > 0)
          patchBody.customAliases = pendingAliases;
        const patchRes = await fetch(`/api/articles/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        if (patchRes.ok) {
          article = (await patchRes.json()) as ArticleDTO;
        }
      }
      setData((prev) =>
        prev ? { ...prev, articles: [...prev.articles, article] } : prev
      );
      setPreview(null);
      setPendingHints([]);
      setPendingAliases([]);
      setFlash(`Added “${article.title}”`);
      setTimeout(() => setFlash(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function removeArticle(articleId: string) {
    const ok = confirm("Remove this article from the set?");
    if (!ok) return;
    const res = await fetch(`/api/articles/${articleId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              articles: prev.articles.filter((a) => a.id !== articleId),
            }
          : prev
      );
    }
  }

  function handleArticleChange(updated: ArticleDTO) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            articles: prev.articles.map((a) =>
              a.id === updated.id ? updated : a
            ),
          }
        : prev
    );
  }

  async function saveName() {
    if (!data) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === data.name) {
      setNameDraft(data.name);
      return;
    }
    const res = await fetch(`/api/sets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setData({ ...data, name: trimmed });
    } else {
      setNameDraft(data.name);
    }
  }

  if (error && !data) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="brut-btn brut-btn-sm bg-white text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
        </Link>
        <div className="brut-card mt-6 bg-accent-red/20 p-4 text-sm font-bold text-slate-900">
          {error}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />{" "}
          Loading…
        </div>
      </main>
    );
  }

  const canPlay = data.articles.length > 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <Link
        href="/"
        className="brut-btn brut-btn-sm bg-white text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full border-0 border-b-[3px] border-transparent bg-transparent pb-1 font-display text-5xl text-slate-900 outline-none focus:border-slate-900"
          />
          <div className="mt-1 text-xs font-extrabold uppercase tracking-widest text-slate-500">
            {data.articles.length}{" "}
            {data.articles.length === 1 ? "article" : "articles"}
          </div>
        </div>
        <button
          type="button"
          disabled={!canPlay}
          onClick={() => router.push(`/play/${id}`)}
          className="brut-btn bg-accent-yellow text-slate-900"
        >
          <Play className="h-4 w-4" fill="currentColor" strokeWidth={3} />{" "}
          Play
        </button>
      </div>

      <section className="mt-8 space-y-3">
        <WikipediaAutocomplete
          onSubmit={handleAdd}
          loading={previewLoading}
          placeholder="Paste a Wikipedia URL or type an article name…"
        />
        {error && (
          <div className="rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-3 text-sm font-bold text-slate-900">
            {error}
          </div>
        )}
        {flash && (
          <div className="rounded-lg border-[2.5px] border-slate-900 bg-accent-green/30 p-3 text-sm font-bold text-slate-900">
            {flash}
          </div>
        )}
        {preview && (
          <ArticlePreview
            preview={preview}
            hints={pendingHints}
            onHintsChange={setPendingHints}
            aliases={pendingAliases}
            onAliasesChange={setPendingAliases}
            onConfirm={confirmAdd}
            onCancel={() => {
              setPreview(null);
              setPendingHints([]);
              setPendingAliases([]);
            }}
            saving={saving}
          />
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-3xl text-slate-900">
          Articles
        </h2>
        {data.articles.length === 0 ? (
          <div className="brut-card bg-white p-10 text-center text-sm font-semibold text-slate-500">
            No articles yet. Add your first one above.
          </div>
        ) : (
          <ul className="space-y-4">
            {data.articles.map((a, i) => (
              <ArticleRow
                key={a.id}
                index={i}
                article={a}
                onChange={handleArticleChange}
                onRemove={removeArticle}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
