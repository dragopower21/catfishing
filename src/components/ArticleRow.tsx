"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { ArticleDTO } from "@/lib/types";

type Props = {
  index: number;
  article: ArticleDTO;
  onChange: (updated: ArticleDTO) => void;
  onRemove: (id: string) => void;
};

export default function ArticleRow({
  index,
  article,
  onChange,
  onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintDraft, setHintDraft] = useState("");

  async function patch(body: {
    categories?: string[];
    customHints?: string[];
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Update failed");
        return;
      }
      const updated = (await res.json()) as ArticleDTO;
      onChange(updated);
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(cat: string) {
    await patch({
      categories: article.categories.filter((c) => c !== cat),
    });
  }

  async function removeHint(hint: string) {
    await patch({
      customHints: article.customHints.filter((h) => h !== hint),
    });
  }

  async function addHint() {
    const h = hintDraft.trim();
    if (!h) return;
    if (article.customHints.includes(h)) {
      setHintDraft("");
      return;
    }
    await patch({ customHints: [...article.customHints, h] });
    setHintDraft("");
  }

  async function reset() {
    const ok = confirm(
      "Reset this article's categories to the Wikipedia defaults? Your custom hints are kept."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/reset`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Reset failed");
        return;
      }
      const updated = (await res.json()) as ArticleDTO;
      onChange(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="brut-card p-0">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border-[2.5px] border-slate-900 bg-white text-slate-900 hover:bg-paper"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" strokeWidth={3} />
          ) : (
            <ChevronRight className="h-4 w-4" strokeWidth={3} />
          )}
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[2.5px] border-slate-900 bg-accent-yellow font-display text-base text-slate-900">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={article.wikipediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 truncate font-display text-lg text-slate-900 hover:underline"
          >
            {article.title}
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.5} />
          </a>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {article.categories.length} categories
            {article.customHints.length > 0 && (
              <>
                {" · "}
                <span className="text-accent-green">
                  {article.customHints.length} custom
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(article.id)}
          className="brut-btn brut-btn-sm brut-btn-icon bg-accent-red text-white"
          aria-label="Remove article"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {expanded && (
        <div className="border-t-[3px] border-slate-900 bg-paper/50 p-5">
          {error && (
            <div className="mb-3 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-semibold text-slate-900">
              {error}
            </div>
          )}

          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Your hints
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.customHints.length === 0 ? (
              <span className="text-sm italic text-slate-500">
                No custom hints yet.
              </span>
            ) : (
              article.customHints.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-slate-900 bg-accent-green px-3 py-1 text-xs font-extrabold text-slate-900"
                >
                  {h}
                  <button
                    type="button"
                    onClick={() => removeHint(h)}
                    disabled={busy}
                    className="brut-btn-chip bg-white"
                    aria-label={`Remove ${h}`}
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={hintDraft}
              onChange={(e) => setHintDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHint();
                }
              }}
              placeholder="Add a custom hint…"
              disabled={busy}
              className="brut-input flex-1 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addHint}
              disabled={busy || !hintDraft.trim()}
              className="brut-btn brut-btn-sm bg-accent-green text-slate-900"
            >
              <Plus className="h-4 w-4" strokeWidth={3} /> Add
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Wikipedia categories
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="brut-btn brut-btn-sm bg-white text-slate-900"
            >
              {busy ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  strokeWidth={2.5}
                />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
              Reset
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.categories.length === 0 ? (
              <span className="text-sm italic text-slate-500">
                No categories kept. Click &quot;Reset&quot; to restore.
              </span>
            ) : (
              article.categories.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-slate-900 bg-white px-3 py-1 text-xs font-bold text-slate-900"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCategory(c)}
                    disabled={busy}
                    className="brut-btn-chip bg-accent-red/20"
                    aria-label={`Remove ${c}`}
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </li>
  );
}
