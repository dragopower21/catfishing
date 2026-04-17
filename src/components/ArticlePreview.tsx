"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import type { FetchedArticlePreview } from "@/lib/types";

type Props = {
  preview: FetchedArticlePreview;
  hints: string[];
  onHintsChange: (hints: string[]) => void;
  aliases: string[];
  onAliasesChange: (aliases: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
};

export default function ArticlePreview({
  preview,
  hints,
  onHintsChange,
  aliases,
  onAliasesChange,
  onConfirm,
  onCancel,
  saving = false,
}: Props) {
  const [hintDraft, setHintDraft] = useState("");
  const [aliasDraft, setAliasDraft] = useState("");
  const [showWikipediaAliases, setShowWikipediaAliases] = useState(false);
  const tooFew = preview.categories.length < 3;

  function addHint() {
    const h = hintDraft.trim();
    if (!h || hints.includes(h)) return;
    onHintsChange([...hints, h]);
    setHintDraft("");
  }

  function removeHint(h: string) {
    onHintsChange(hints.filter((x) => x !== h));
  }

  function addAlias() {
    const a = aliasDraft.trim();
    if (!a || aliases.includes(a)) return;
    onAliasesChange([...aliases, a]);
    setAliasDraft("");
  }

  function removeAlias(a: string) {
    onAliasesChange(aliases.filter((x) => x !== a));
  }

  return (
    <div className="brut-card overflow-hidden p-0">
      <div className="border-b-[3px] border-slate-900 bg-accent-sky px-5 py-3">
        <span className="text-xs font-extrabold uppercase tracking-widest text-slate-900">
          Preview
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start gap-4">
          {preview.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnailUrl}
              alt={preview.title}
              className="h-24 w-24 shrink-0 rounded-lg border-[3px] border-slate-900 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="block font-display text-2xl leading-tight text-slate-900 hover:underline"
            >
              {preview.title}
            </a>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              {preview.categories.length} useful ·{" "}
              {preview.rawCategoryCount} total · {preview.aliases.length}{" "}
              aliases
            </div>
          </div>
        </div>

        {preview.summary && (
          <p className="mt-3 line-clamp-3 text-sm text-slate-700">
            {preview.summary}
          </p>
        )}

        {tooFew && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border-[3px] border-slate-900 bg-accent-yellow p-3 text-sm font-semibold text-slate-900">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={2.5}
            />
            <span>
              Only {preview.categories.length} useful{" "}
              {preview.categories.length === 1 ? "category" : "categories"} —
              it may be too easy or impossible to guess. Add anyway?
            </span>
          </div>
        )}

        <div className="mt-5 text-xs font-extrabold uppercase tracking-widest text-slate-600">
          Wikipedia categories
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {preview.categories.length === 0 ? (
            <span className="text-sm italic text-slate-500">
              No useful categories after filtering.
            </span>
          ) : (
            preview.categories.map((c) => (
              <span
                key={c}
                className="rounded-full border-[2.5px] border-slate-900 bg-white px-3 py-1 text-xs font-bold text-slate-900"
              >
                {c}
              </span>
            ))
          )}
        </div>

        <div className="mt-5 text-xs font-extrabold uppercase tracking-widest text-slate-600">
          Your own hints
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hints.map((h) => (
            <span
              key={h}
              className="inline-flex items-center gap-1 rounded-full border-[2.5px] border-slate-900 bg-accent-green px-3 py-1 text-xs font-extrabold text-slate-900"
            >
              {h}
              <button
                type="button"
                onClick={() => removeHint(h)}
                className="brut-btn-chip bg-white p-0.5"
                aria-label={`Remove ${h}`}
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
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
            className="brut-input flex-1 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addHint}
            disabled={!hintDraft.trim()}
            className="brut-btn brut-btn-sm bg-accent-green text-slate-900"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Add
          </button>
        </div>

        <div className="mt-5 text-xs font-extrabold uppercase tracking-widest text-slate-600">
          Your own aliases{" "}
          <span className="font-medium text-slate-400 normal-case tracking-normal">
            — extra accepted answers
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {aliases.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-full border-[2.5px] border-slate-900 bg-accent-pink px-3 py-1 text-xs font-extrabold text-slate-900"
            >
              {a}
              <button
                type="button"
                onClick={() => removeAlias(a)}
                className="brut-btn-chip bg-white p-0.5"
                aria-label={`Remove ${a}`}
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={aliasDraft}
            onChange={(e) => setAliasDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAlias();
              }
            }}
            placeholder="Add an accepted answer…"
            className="brut-input flex-1 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addAlias}
            disabled={!aliasDraft.trim()}
            className="brut-btn brut-btn-sm bg-accent-pink text-slate-900"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Add
          </button>
        </div>

        {preview.aliases.length > 0 && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowWikipediaAliases((v) => !v)}
              className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest text-slate-600 hover:text-slate-900"
            >
              {showWikipediaAliases ? (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
              )}
              Wikipedia aliases ({preview.aliases.length})
            </button>
            {showWikipediaAliases && (
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-auto">
                {preview.aliases.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border-2 border-slate-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="brut-btn bg-white text-slate-900"
          >
            <X className="h-4 w-4" strokeWidth={2.5} /> Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={
              saving ||
              (preview.categories.length === 0 && hints.length === 0)
            }
            className="brut-btn bg-accent-yellow text-slate-900"
          >
            <Check className="h-4 w-4" strokeWidth={3} />{" "}
            {saving ? "Adding…" : "Add to Set"}
          </button>
        </div>
      </div>
    </div>
  );
}
