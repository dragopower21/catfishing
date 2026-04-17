"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { sound } from "@/lib/sound";

type Props = {
  text: string;
};

export default function ShareButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
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

  return (
    <button
      type="button"
      onClick={handleClick}
      data-silent
      className={`brut-btn ${
        copied ? "bg-accent-green" : "bg-accent-pink"
      } text-slate-900`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" strokeWidth={3} /> Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" strokeWidth={2.5} /> Share result
        </>
      )}
    </button>
  );
}
