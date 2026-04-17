"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Search } from "lucide-react";
import type { SetSummary } from "@/lib/types";

type Props = {
  sets: SetSummary[];
  placeholder?: string;
};

export default function SetSearch({
  sets,
  placeholder = "Search every set by name or description…",
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return sets
      .filter((s) => {
        const hay = `${s.name} ${s.description ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // Name-hits first, then by article count descending
        const aName = a.name.toLowerCase().includes(q);
        const bName = b.name.toLowerCase().includes(q);
        if (aName && !bName) return -1;
        if (!aName && bName) return 1;
        return b.articleCount - a.articleCount;
      })
      .slice(0, 8);
  }, [value, sets]);

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

  function commit(id: string) {
    setValue("");
    setOpen(false);
    router.push(`/play/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
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
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[activeIdx] ?? matches[0];
      if (pick) commit(pick.id);
    }
  }

  if (sets.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <div className="brut-input flex items-center gap-2 py-0">
        <Search
          className="h-5 w-5 shrink-0 text-slate-900"
          strokeWidth={2.5}
        />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => {
            if (matches.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 text-base font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-500"
        />
        {value.trim() && (
          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </span>
        )}
      </div>
      {open && matches.length > 0 && (
        <ul className="brut-card absolute z-20 mt-2 max-h-96 w-full overflow-auto p-0">
          {matches.map((s, i) => (
            <li
              key={s.id}
              className={
                i < matches.length - 1
                  ? "border-b-[2.5px] border-slate-900"
                  : ""
              }
            >
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(s.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  i === activeIdx ? "bg-accent-yellow" : "hover:bg-paper"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-lg text-slate-900">
                      {s.name}
                    </span>
                    {s.isMine && (
                      <span className="shrink-0 rounded-full border-2 border-slate-900 bg-accent-green px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-900">
                        Yours
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <div className="truncate text-xs font-medium text-slate-600">
                      {s.description}
                    </div>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full border-[2px] border-slate-900 bg-white px-2.5 py-0.5 text-xs font-extrabold tabular-nums text-slate-900"
                  title={`${s.articleCount} articles`}
                >
                  {s.articleCount}
                </span>
                <Play
                  className="h-4 w-4 shrink-0 text-slate-500"
                  fill="currentColor"
                  strokeWidth={2.5}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
