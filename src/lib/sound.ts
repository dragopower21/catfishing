// Tiny procedural sound kit — no audio files. Uses Web Audio API to
// synthesize short tones. All calls are no-ops on the server.

type ToneOpts = {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  offsetMs?: number;
};

let ctx: AudioContext | null = null;
let muted = false;
let didHydrate = false;

function hydrateMute() {
  if (didHydrate || typeof window === "undefined") return;
  try {
    muted = window.localStorage.getItem("cf:mute") === "1";
  } catch {
    // ignore
  }
  didHydrate = true;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

function tone(freq: number, duration: number, opts: ToneOpts = {}) {
  hydrateMute();
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const {
    type = "sine",
    gain = 0.05,
    attack = 0.005,
    offsetMs = 0,
  } = opts;

  const start = c.currentTime + offsetMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.04);
}

export const sound = {
  setMuted(m: boolean) {
    hydrateMute();
    muted = m;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("cf:mute", m ? "1" : "0");
      } catch {
        // ignore
      }
    }
  },
  isMuted(): boolean {
    hydrateMute();
    return muted;
  },

  // Tiny tactile click for generic button presses.
  click() {
    tone(900, 0.035, { type: "square", gain: 0.025 });
  },

  // Ascending triad — correct guess.
  correct() {
    tone(523.25, 0.1, { type: "triangle", gain: 0.06 });
    tone(659.25, 0.1, { type: "triangle", gain: 0.06, offsetMs: 80 });
    tone(783.99, 0.18, { type: "triangle", gain: 0.06, offsetMs: 160 });
  },

  // Low descending buzz — wrong guess.
  wrong() {
    tone(196, 0.18, { type: "sawtooth", gain: 0.05 });
    tone(155.56, 0.22, { type: "sawtooth", gain: 0.04, offsetMs: 90 });
  },

  // Two-note rising motif — starting a set.
  start() {
    tone(523.25, 0.08, { type: "triangle", gain: 0.055 });
    tone(783.99, 0.18, { type: "triangle", gain: 0.055, offsetMs: 90 });
  },

  // Four-note major arpeggio — finishing a set.
  finish() {
    tone(523.25, 0.45, { type: "sine", gain: 0.04 });
    tone(659.25, 0.45, { type: "sine", gain: 0.04, offsetMs: 110 });
    tone(783.99, 0.5, { type: "sine", gain: 0.04, offsetMs: 220 });
    tone(1046.5, 0.55, { type: "sine", gain: 0.04, offsetMs: 340 });
  },

  // High chime — clipboard copy confirmation.
  copy() {
    tone(1200, 0.08, { type: "triangle", gain: 0.035 });
    tone(1600, 0.08, { type: "triangle", gain: 0.025, offsetMs: 40 });
  },

  // Soft whoosh — skipping an article.
  skip() {
    tone(440, 0.08, { type: "sine", gain: 0.04 });
    tone(330, 0.12, { type: "sine", gain: 0.035, offsetMs: 60 });
  },
};

// -- Global click delegation -------------------------------------------------
// Any `.brut-btn` or `.brut-card-link` that isn't marked `data-silent`
// gets a quiet tactile click by default. Buttons that trigger their own
// specific sound (correct/wrong/next/skip) opt out with `data-silent`.

if (typeof window !== "undefined") {
  const warmUp = () => {
    ensureCtx();
  };
  // First interaction unblocks the AudioContext (required on most browsers).
  window.addEventListener("pointerdown", warmUp, {
    once: true,
    capture: true,
  });
  window.addEventListener("keydown", warmUp, {
    once: true,
    capture: true,
  });

  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest(
        ".brut-btn, .brut-card-link"
      );
      if (!el) return;
      if (el.hasAttribute("data-silent")) return;
      if (el instanceof HTMLButtonElement && el.disabled) return;
      if (
        el.getAttribute("aria-disabled") === "true" ||
        el.classList.contains("pointer-events-none")
      ) {
        return;
      }
      sound.click();
    },
    true
  );
}
