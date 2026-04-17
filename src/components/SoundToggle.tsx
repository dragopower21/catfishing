"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sound } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMuted(sound.isMuted());
    setMounted(true);
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
    if (!next) sound.click();
  }

  // Avoid a hydration mismatch — the server can't know the localStorage
  // value, so render a neutral placeholder until mounted.
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

  return (
    <button
      type="button"
      onClick={toggle}
      data-silent
      className="brut-btn brut-btn-sm brut-btn-icon bg-white text-slate-900"
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Sounds off — click to enable" : "Sounds on — click to mute"}
    >
      {muted ? (
        <VolumeX className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <Volume2 className="h-4 w-4" strokeWidth={2.5} />
      )}
    </button>
  );
}
