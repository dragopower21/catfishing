"use client";

import { useEffect, useRef, useState } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { sound } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMuted(sound.isMuted());
    setVolume(sound.getVolume());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
    if (!next) sound.click();
  }

  function updateVolume(v: number) {
    setVolume(v);
    sound.setVolume(v);
  }

  // Placeholder during SSR/hydration — don't reveal the muted state until mounted.
  if (!mounted) {
    return (
      <button
        type="button"
        className="brut-btn brut-btn-sm brut-btn-icon bg-white text-slate-900"
        aria-label="Sound"
        data-silent
      >
        <Volume2 className="h-4 w-4" strokeWidth={2.5} />
      </button>
    );
  }

  const Icon = muted
    ? VolumeX
    : volume < 0.33
      ? Volume1
      : Volume2;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-silent
        className={`brut-btn brut-btn-sm brut-btn-icon ${
          muted
            ? "bg-accent-red text-white"
            : "bg-white text-slate-900"
        }`}
        aria-label="Sound settings"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </button>

      {open && (
        <div
          className="brut-card absolute right-0 top-[calc(100%+10px)] z-50 w-64 bg-white p-4"
          role="dialog"
          aria-label="Sound settings"
        >
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Sound
          </div>

          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900">Mute</span>
            <button
              type="button"
              onClick={toggleMute}
              data-silent
              role="switch"
              aria-checked={muted}
              className={`relative h-7 w-12 rounded-full border-[2.5px] border-slate-900 transition ${
                muted ? "bg-accent-red" : "bg-accent-green"
              }`}
            >
              <span
                className={`absolute top-[2px] h-[20px] w-[20px] rounded-full border-2 border-slate-900 bg-white transition-all ${
                  muted ? "left-[2px]" : "left-[20px]"
                }`}
              />
            </button>
          </label>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Volume
              </span>
              <span className="tabular-nums text-xs font-bold text-slate-500">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(volume * 100)}
              onChange={(e) => updateVolume(Number(e.target.value) / 100)}
              onPointerUp={() => {
                if (!muted) sound.click();
              }}
              disabled={muted}
              aria-label="Volume"
              className="brut-range mt-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}
