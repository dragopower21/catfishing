"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function NewSetPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Set name is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to create set");
        return;
      }
      const created = await res.json();
      router.push(`/sets/${created.id}/edit`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <Link
        href="/"
        className="brut-btn brut-btn-sm bg-white text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
      </Link>
      <h1 className="mt-6 font-display text-5xl text-slate-900">
        New set
      </h1>
      <p className="mt-2 font-semibold text-slate-600">
        Name it, then add Wikipedia articles on the next screen.
      </p>

      <form
        onSubmit={handleSubmit}
        className="brut-card mt-8 bg-white p-6"
      >
        <label className="block">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Set name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Geography"
            autoFocus
            className="brut-input mt-2 block w-full text-lg"
          />
        </label>

        <label className="mt-5 block">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Description <span className="text-slate-400">(optional)</span>
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A one-liner"
            className="brut-input mt-2 block w-full"
          />
        </label>

        {error && (
          <div className="mt-5 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-3 text-sm font-bold text-slate-900">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="brut-btn bg-accent-yellow text-slate-900"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
            Create set
          </button>
        </div>
      </form>
    </main>
  );
}
