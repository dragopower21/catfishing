"use client";

import { useEffect, useRef, useState } from "react";
import { SkipForward, Send } from "lucide-react";

type Props = {
  onSubmit: (guess: string) => void;
  onSkip: () => void;
  disabled?: boolean;
  resetKey?: string | number;
};

export default function GuessInput({
  onSubmit,
  onSkip,
  disabled,
  resetKey,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [resetKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type your guess…"
        autoComplete="off"
        className="brut-input flex-1 text-lg font-semibold disabled:opacity-50"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          data-silent
          className="brut-btn flex-1 bg-accent-yellow px-5 py-4 text-slate-900 sm:flex-initial"
        >
          <Send className="h-4 w-4" strokeWidth={3} /> Submit
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          data-silent
          className="brut-btn bg-white px-5 py-4 text-slate-900"
        >
          <SkipForward className="h-4 w-4" strokeWidth={3} /> Skip
        </button>
      </div>
    </form>
  );
}
