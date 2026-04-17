"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

type Props = {
  text: string;
};

export default function ShareButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
