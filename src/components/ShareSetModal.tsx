"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Link2, X } from "lucide-react";
import { sound } from "@/lib/sound";

type Props = {
  setName: string;
  setId: string;
  onClose: () => void;
};

export default function ShareSetModal({ setName, setId, onClose }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const url = origin ? `${origin}/play/${setId}` : `/play/${setId}`;

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    if (ok) {
      setCopied(true);
      sound.copy();
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="brut-card animate-pop-in w-full max-w-md bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="brut-sticker bg-accent-pink text-slate-900">
              Share
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-[2.5px] border-slate-900 bg-white text-slate-900 hover:bg-paper"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        <div className="mt-3 font-display text-2xl text-slate-900">
          {setName}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Anyone with this link can play this set. No signup, just open and
          go.
        </p>

        <div className="mt-5 flex items-stretch gap-2">
          <div className="brut-input flex flex-1 items-center gap-2 py-0">
            <Link2
              className="h-4 w-4 shrink-0 text-slate-400"
              strokeWidth={2.5}
            />
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-transparent py-3 text-sm font-semibold text-slate-900 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={copy}
            data-silent
            className={`brut-btn ${
              copied ? "bg-accent-green" : "bg-accent-yellow"
            } text-slate-900`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" strokeWidth={3} /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" strokeWidth={2.5} /> Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
