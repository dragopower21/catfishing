"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Play, Share2, Trash2 } from "lucide-react";
import ShareSetModal from "@/components/ShareSetModal";
import type { SetSummary } from "@/lib/types";

type Props = {
  set: SetSummary;
  onDelete: (id: string) => void;
  accentColor: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const when = new Date(iso);
  const diffMs = Date.now() - when.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return when.toLocaleDateString();
}

export default function SetCard({ set, onDelete, accentColor }: Props) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const canPlay = set.articleCount > 0;
  const canEdit = set.canManage;

  const headerAction = canEdit ? (
    <Link
      href={`/sets/${set.id}/edit`}
      className="flex flex-1 flex-col p-5"
      aria-label={`Edit ${set.name}`}
    >
      {renderHeader()}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => canPlay && router.push(`/play/${set.id}`)}
      disabled={!canPlay}
      className="flex flex-1 flex-col p-5 text-left"
      aria-label={`Play ${set.name}`}
    >
      {renderHeader()}
    </button>
  );

  function renderHeader() {
    return (
      <>
        <div
          className="-mx-5 -mt-5 mb-4 border-b-[3px] border-slate-900 px-5 py-3"
          style={{ backgroundColor: accentColor }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-900">
              {set.isMine ? "Your set" : "Public"}
            </span>
            <span className="brut-pill bg-white text-slate-900">
              {set.articleCount}{" "}
              {set.articleCount === 1 ? "article" : "articles"}
            </span>
          </div>
        </div>

        <h3 className="font-display text-2xl leading-tight text-slate-900">
          {set.name}
        </h3>
        {set.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
            {set.description}
          </p>
        ) : (
          <p className="mt-1 text-sm italic text-slate-400">No description</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span>Last played · {formatWhen(set.lastPlayedAt)}</span>
          {set.creatorName && (
            <>
              <span aria-hidden>·</span>
              <span>
                by{" "}
                <span className="text-slate-700 normal-case tracking-normal">
                  {set.creatorName}
                </span>
              </span>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="brut-card-link group relative flex flex-col overflow-hidden">
      {headerAction}

      <div className="flex items-stretch gap-2 border-t-[3px] border-slate-900 bg-paper/50 p-3">
        <button
          type="button"
          disabled={!canPlay}
          onClick={() => router.push(`/play/${set.id}`)}
          className="brut-btn brut-btn-sm flex-1 bg-accent-yellow text-slate-900"
        >
          <Play className="h-4 w-4" fill="currentColor" strokeWidth={2.5} /> Play
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="brut-btn brut-btn-sm brut-btn-icon bg-accent-pink text-slate-900"
          aria-label="Share"
          title="Share this set"
        >
          <Share2 className="h-4 w-4" strokeWidth={2.5} />
        </button>
        {canEdit && (
          <>
            <Link
              href={`/sets/${set.id}/edit`}
              className="brut-btn brut-btn-sm brut-btn-icon bg-white text-slate-900"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <button
              type="button"
              onClick={() => onDelete(set.id)}
              className="brut-btn brut-btn-sm brut-btn-icon bg-accent-red text-white"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {shareOpen && (
        <ShareSetModal
          setName={set.name}
          setId={set.id}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
