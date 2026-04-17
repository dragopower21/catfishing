"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { WikipediaSuggestion } from "@/lib/wikipedia";

type Props = {
  onSubmit: (urlOrTitle: string) => void;
  loading?: boolean;
  placeholder?: string;
};

export default function WikipediaAutocomplete({
  onSubmit,
  loading = false,
  placeholder = "Paste a Wikipedia URL or type an article name…",
}: Props) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<WikipediaSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const isUrl = value.trim().startsWith("http");

  useEffect(() => {
    if (isUrl) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const q = value.trim();
    if (!q) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(
          `/api/wikipedia/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const data = (await res.json()) as WikipediaSuggestion[];
          setSuggestions(data);
          setOpen(data.length > 0);
          setActiveIdx(-1);
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [value, isUrl]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function commit(text: string) {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setValue("");
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        commit(suggestions[activeIdx].title);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit(value);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-stretch gap-2">
        <div className="brut-input flex flex-1 items-center gap-2 px-3 py-0">
          <Search
            className="h-5 w-5 shrink-0 text-slate-900"
            strokeWidth={2.5}
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0 && !isUrl) setOpen(true);
            }}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1 bg-transparent py-3 text-base font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-500 disabled:opacity-50"
          />
          {(isSearching || loading) && (
            <Loader2
              className="h-4 w-4 animate-spin text-slate-900"
              strokeWidth={2.5}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => commit(value)}
          disabled={loading || !value.trim()}
          className="brut-btn bg-accent-yellow text-slate-900"
        >
          Add
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <ul className="brut-card absolute z-20 mt-2 max-h-80 w-full overflow-auto p-0">
          {suggestions.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className={
                i < suggestions.length - 1
                  ? "border-b-[2.5px] border-slate-900"
                  : ""
              }
            >
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(s.title)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  i === activeIdx ? "bg-accent-yellow" : "hover:bg-paper"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-900">
                    {s.title}
                  </div>
                  {s.description && (
                    <div className="truncate text-xs font-medium text-slate-600">
                      {s.description}
                    </div>
                  )}
                </div>
                <CategoryBadge count={s.categoryCount} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryBadge({ count }: { count: number | null | undefined }) {
  if (count === null || count === undefined) {
    // Count not yet resolved (rare) — keep space reserved so rows don't jump.
    return (
      <span className="shrink-0 text-xs font-bold text-slate-300">—</span>
    );
  }
  const tone =
    count === 0
      ? "bg-accent-red/30 text-slate-900"
      : count < 3
        ? "bg-accent-yellow text-slate-900"
        : "bg-accent-green text-slate-900";
  return (
    <span
      className={`shrink-0 rounded-full border-[2px] border-slate-900 px-2 py-0.5 text-xs font-extrabold tabular-nums ${tone}`}
      title={`${count} useful ${count === 1 ? "category" : "categories"}`}
    >
      {count}
    </span>
  );
}
