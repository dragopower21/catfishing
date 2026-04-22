"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Gamepad2,
  Loader2,
  Lock,
  Play,
  Plus,
  Send,
  Share2,
  StopCircle,
  Trophy,
  Users,
  X,
} from "lucide-react";
import WikipediaAutocomplete from "@/components/WikipediaAutocomplete";
import {
  getPusherClient,
  lobbyChannelName,
  pusherClientConfigured,
} from "@/lib/pusherClient";
import { sound } from "@/lib/sound";
import type {
  FetchedArticlePreview,
  LobbyMemberDTO,
  LobbyMessageDTO,
  LobbyState,
} from "@/lib/types";

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const router = useRouter();

  const [state, setState] = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // memberId → timestamp of their most recent typing signal
  const [typingAt, setTypingAt] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lobbies/${code}`);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Lobby not found.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as LobbyState;
    setState(data);
    setLoading(false);
  }, [code]);

  // Keep a mutable ref to the latest refresh fn so event handlers
  // bound once in a stable-deps effect can always call the latest.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Is the current browser an actual lobby member? Booleanize so
  // that refresh-driven state updates don't churn the subscription.
  const isMember = Boolean(state?.me);

  // Subscribe to Pusher presence channel once we're a member. Deps are
  // `isMember + code` so the subscription is stable across state
  // refreshes — otherwise we'd tear down + re-subscribe on every GET,
  // which can cause the presence auth to fail partway and drop events.
  useEffect(() => {
    if (!isMember) return;
    if (!pusherClientConfigured()) return;
    const p = getPusherClient();
    if (!p) return;
    const ch = p.subscribe(lobbyChannelName(code));

    const bust = () => refreshRef.current();
    const events = [
      "member-joined",
      "member-left",
      "round-started",
      "round-active",
      "round-ended",
      "game-ended",
      "correct-guess",
      "picker-bonus",
    ];
    events.forEach((e) => ch.bind(e, bust));

    const onChat = (msg: LobbyMessageDTO) => {
      setState((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev
      );
    };
    ch.bind("chat-message", onChat);

    const onCorrect = () => sound.correct();
    ch.bind("correct-guess", onCorrect);

    type TypingMeta = { user_id?: string };
    const onTyping = (_data: unknown, meta?: TypingMeta) => {
      if (!meta?.user_id) return;
      setTypingAt((prev) => ({ ...prev, [meta.user_id!]: Date.now() }));
    };
    const onStopTyping = (_data: unknown, meta?: TypingMeta) => {
      if (!meta?.user_id) return;
      setTypingAt((prev) => {
        const out = { ...prev };
        delete out[meta.user_id!];
        return out;
      });
    };
    ch.bind("client-typing", onTyping);
    ch.bind("client-stop-typing", onStopTyping);

    return () => {
      events.forEach((e) => ch.unbind(e, bust));
      ch.unbind("chat-message", onChat);
      ch.unbind("correct-guess", onCorrect);
      ch.unbind("client-typing", onTyping);
      ch.unbind("client-stop-typing", onStopTyping);
      p.unsubscribe(lobbyChannelName(code));
    };
  }, [isMember, code]);

  // Sweep stale typing signals (>4s old) every second.
  useEffect(() => {
    const id = setInterval(() => {
      setTypingAt((prev) => {
        const now = Date.now();
        let changed = false;
        const out: Record<string, number> = {};
        for (const [k, t] of Object.entries(prev)) {
          if (now - t < 4000) out[k] = t;
          else changed = true;
        }
        return changed ? out : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Safety-net: poll state every 5s so even a completely silent Pusher
  // connection still eventually surfaces round advances.
  useEffect(() => {
    if (!isMember) return;
    const id = setInterval(() => {
      refreshRef.current();
    }, 5000);
    return () => clearInterval(id);
  }, [isMember]);

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />{" "}
          Loading lobby…
        </div>
      </main>
    );
  }
  if (error || !state) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Link
          href="/multiplayer"
          className="brut-btn brut-btn-sm bg-white text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
        </Link>
        <div className="brut-card mt-6 bg-accent-red/20 p-4 text-sm font-bold text-slate-900">
          {error ?? "Lobby not found"}
        </div>
      </main>
    );
  }

  if (!state.me) {
    return <JoinGate code={code} state={state} onJoined={refresh} />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <LobbyHeader
        code={code}
        state={state}
        router={router}
        onRefresh={refresh}
      />

      {state.status === "WAITING" ? (
        <WaitingRoom code={code} state={state} onRefresh={refresh} />
      ) : state.status === "IN_GAME" ? (
        <GameScreen
          code={code}
          state={state}
          onRefresh={refresh}
          typingAt={typingAt}
        />
      ) : (
        <EndScreen state={state} />
      )}
    </main>
  );
}

// ---------- Header ----------

function LobbyHeader({
  code,
  state,
  router,
  onRefresh,
}: {
  code: string;
  state: LobbyState;
  router: ReturnType<typeof useRouter>;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/multiplayer/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function endRoom() {
    const ok = confirm(
      "End the room now? Everyone will see the final scoreboard."
    );
    if (!ok) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/lobbies/${code}/end`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b.error ?? "Failed to end room");
      }
      onRefresh();
    } finally {
      setEnding(false);
    }
  }

  const canEnd =
    state.me?.isHost && state.status !== "ENDED";

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => router.push("/multiplayer")}
        className="brut-btn brut-btn-sm bg-white text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Leave
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <span className="brut-pill bg-white text-slate-900">
          <Gamepad2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          {state.mode === "FREESTYLE" ? "Freestyle" : "Set"}
        </span>
        {state.status === "IN_GAME" && (
          <span className="brut-pill bg-accent-sky text-slate-900">
            Round {state.currentRoundNumber} / {state.totalRounds}
          </span>
        )}
        {state.hasPassword && (
          <span className="brut-pill bg-accent-yellow text-slate-900">
            <Lock className="h-3.5 w-3.5" strokeWidth={2.5} /> Password
          </span>
        )}
        <span
          className="brut-pill bg-white font-mono tracking-[0.3em] text-slate-900"
          title="Lobby code"
        >
          {code}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className={`brut-btn brut-btn-sm ${
            copied ? "bg-accent-green" : "bg-accent-pink"
          } text-slate-900`}
          data-silent
        >
          {copied ? (
            <>
              <Copy className="h-4 w-4" strokeWidth={2.5} /> Copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" strokeWidth={2.5} /> Share
            </>
          )}
        </button>
        {canEnd && (
          <button
            type="button"
            onClick={endRoom}
            disabled={ending}
            className="brut-btn brut-btn-sm bg-accent-red text-white"
            title="End the room for everyone"
          >
            {ending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <StopCircle className="h-4 w-4" strokeWidth={2.5} />
            )}
            End room
          </button>
        )}
      </div>
    </header>
  );
}

// ---------- Waiting room ----------

function WaitingRoom({
  code,
  state,
  onRefresh,
}: {
  code: string;
  state: LobbyState;
  onRefresh: () => void;
}) {
  const me = state.me!;
  const canStart = me.isHost && state.memberCount >= 2;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${code}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Failed to start");
        return;
      }
      onRefresh();
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="brut-card bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Waiting room
          </div>
          <h2 className="font-display text-3xl text-slate-900">
            {state.mode === "FREESTYLE" ? "Freestyle" : state.setName ?? "Set"}
          </h2>
          <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            {state.roundDuration}s / round · {state.totalRounds} rounds
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Users className="h-4 w-4" strokeWidth={2.5} />
          {state.memberCount} / 8
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {state.members.map((m) => (
          <MemberRow key={m.id} m={m} />
        ))}
      </ul>

      {error && (
        <div className="mt-4 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col items-end gap-2">
        {me.isHost ? (
          <>
            <button
              type="button"
              disabled={!canStart || starting}
              onClick={start}
              className="brut-btn bg-accent-yellow text-slate-900"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
              ) : (
                <Play
                  className="h-4 w-4"
                  fill="currentColor"
                  strokeWidth={3}
                />
              )}
              Start game
            </button>
            {!canStart && (
              <p className="text-xs font-bold text-slate-500">
                Need at least 2 players to start.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-bold text-slate-500">
            Waiting for the host to start…
          </p>
        )}
      </div>
    </section>
  );
}

function MemberRow({ m }: { m: LobbyMemberDTO }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border-[2.5px] border-slate-900 px-3 py-2 ${
        m.isMe ? "bg-accent-yellow" : "bg-paper/50"
      }`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-slate-900 bg-white font-display text-sm">
        {m.displayName[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1 truncate font-display text-lg text-slate-900">
        {m.displayName}
        {m.isMe && (
          <span className="ml-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            you
          </span>
        )}
      </div>
      {m.isHost && (
        <span
          className="inline-flex items-center gap-1 rounded-full border-2 border-slate-900 bg-accent-pink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-900"
          title="Lobby host"
        >
          <Crown className="h-3 w-3" strokeWidth={3} /> Host
        </span>
      )}
    </li>
  );
}

// ---------- Game screen ----------

function GameScreen({
  code,
  state,
  onRefresh,
  typingAt,
}: {
  code: string;
  state: LobbyState;
  onRefresh: () => void;
  typingAt: Record<string, number>;
}) {
  const me = state.me!;
  const round = state.currentRound;
  const picker = state.picker;
  const amPicker = picker?.id === me.id;
  const iAlreadyGuessed = state.messages.some(
    (m) =>
      m.type === "CORRECT_GUESS" &&
      m.memberId === me.id &&
      m.roundId === round?.id
  );

  // Client-side clock — just for rendering. Server is still source of truth.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const endsAtMs = round?.endsAt ? new Date(round.endsAt).getTime() : null;
  const remainingMs =
    endsAtMs !== null ? Math.max(0, endsAtMs - now) : null;
  const remainingSec =
    remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  // Poke the server when an ACTIVE round's timer runs out. Advancing
  // past an ENDED round is host-driven (button), so we don't auto-tick
  // for those. setTimeout schedules the first poke at the deadline,
  // then falls back to a 2.5s interval until the round actually moves
  // (Pusher hiccup / missed broadcast safety).
  useEffect(() => {
    if (!round) return;
    if (round.status !== "ACTIVE") return;
    const endsAtMsLocal = round.endsAt
      ? new Date(round.endsAt).getTime()
      : null;
    if (endsAtMsLocal === null) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poke = async () => {
      if (cancelled) return;
      try {
        await fetch(`/api/lobbies/${code}/tick`, { method: "POST" });
      } catch {
        // ignore — onRefresh below still triggers a server-side tick
      }
      if (!cancelled) onRefresh();
    };

    const startPolling = () => {
      if (cancelled) return;
      poke();
      intervalId = setInterval(poke, 2500);
    };

    const msUntilExpiry = endsAtMsLocal - Date.now();
    if (msUntilExpiry <= 0) {
      startPolling();
    } else {
      timeoutId = setTimeout(startPolling, msUntilExpiry);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [round?.id, round?.endsAt, round?.status, code, onRefresh]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="brut-card bg-white p-5 sm:p-6">
        {/* Timer + picker banner */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock
              className="h-5 w-5 text-slate-900"
              strokeWidth={2.5}
            />
            <span
              className={`font-display text-3xl tabular-nums ${
                round?.status === "ACTIVE" &&
                remainingSec !== null &&
                remainingSec <= 10
                  ? "text-accent-red"
                  : "text-slate-900"
              }`}
            >
              {round?.status === "ACTIVE" && remainingSec !== null
                ? `${remainingSec}s`
                : "—"}
            </span>
          </div>
          {picker && (
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Picker:{" "}
              <span className="text-slate-900 normal-case tracking-normal">
                {picker.displayName}
                {amPicker && " (you)"}
              </span>
            </div>
          )}
        </div>

        {/* Round body */}
        <div className="mt-5">
          {round?.status === "PICKING" && (
            <PickingPhase
              code={code}
              amPicker={amPicker}
              pickerName={picker?.displayName ?? "someone"}
              onRefresh={onRefresh}
            />
          )}
          {round?.status === "ACTIVE" && (
            <ActivePhase
              round={round}
              amPicker={amPicker}
              iAlreadyGuessed={iAlreadyGuessed}
            />
          )}
          {round?.status === "ENDED" && state.lastReveal && (
            <RevealPhase
              code={code}
              reveal={state.lastReveal}
              isHost={me.isHost}
              isLastRound={state.currentRoundNumber >= state.totalRounds}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <Scoreboard members={state.members} />
        <ChatBox
          code={code}
          state={state}
          amPicker={amPicker}
          iAlreadyGuessed={iAlreadyGuessed}
          roundActive={round?.status === "ACTIVE"}
          typingAt={typingAt}
        />
      </aside>
    </div>
  );
}

function PickingPhase({
  code,
  amPicker,
  pickerName,
  onRefresh,
}: {
  code: string;
  amPicker: boolean;
  pickerName: string;
  onRefresh: () => void;
}) {
  const [preview, setPreview] = useState<FetchedArticlePreview | null>(null);
  const [pendingInput, setPendingInput] = useState<string>("");
  const [customHints, setCustomHints] = useState<string[]>([]);
  const [hintDraft, setHintDraft] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPreview(urlOrTitle: string) {
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch("/api/wikipedia/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrTitle }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Fetch failed");
        return;
      }
      const data = (await res.json()) as FetchedArticlePreview;
      setPreview(data);
      setPendingInput(urlOrTitle);
      setCustomHints([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  function addHint() {
    const h = hintDraft.trim();
    if (!h || customHints.includes(h)) return;
    if (customHints.length >= 10) return;
    setCustomHints([...customHints, h]);
    setHintDraft("");
  }

  function removeHint(h: string) {
    setCustomHints(customHints.filter((x) => x !== h));
  }

  async function lockIn() {
    if (!preview || !pendingInput) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${code}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlOrTitle: pendingInput,
          customHints,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Pick failed");
        if (res.status === 403 || res.status === 409) onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setPendingInput("");
    setCustomHints([]);
    setHintDraft("");
    setError(null);
  }

  if (!amPicker) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="brut-sticker bg-accent-pink text-slate-900">
          Picking
        </span>
        <div className="font-display text-2xl text-slate-900">
          {pickerName} is picking an article…
        </div>
        <p className="max-w-md text-sm font-semibold text-slate-600">
          Once they pick, the timer starts and you can type your guess in chat.
        </p>
      </div>
    );
  }

  // Stage 1: search for an article.
  if (!preview) {
    return (
      <div>
        <span className="brut-sticker bg-accent-yellow text-slate-900">
          Your turn
        </span>
        <h3 className="mt-3 font-display text-2xl text-slate-900">
          Pick an article for everyone to guess.
        </h3>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Type or paste any Wikipedia article. The more niche yet guessable,
          the more points you get.
        </p>
        <div className="mt-4">
          <WikipediaAutocomplete
            onSubmit={fetchPreview}
            loading={loadingPreview}
            placeholder="Search Wikipedia or paste a URL…"
          />
        </div>
        {error && (
          <div className="mt-3 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Stage 2: preview + hints + lock-in.
  const categoryCount = preview.categories.length;
  const tooFew = categoryCount < 3;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="brut-sticker bg-accent-yellow text-slate-900">
          Preview
        </span>
        <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
          Only you can see this
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        {preview.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.thumbnailUrl}
            alt={preview.title}
            className="h-24 w-24 shrink-0 rounded-lg border-[3px] border-slate-900 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl leading-tight text-slate-900">
            {preview.title}
          </div>
          <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            {categoryCount} useful ·{" "}
            {preview.rawCategoryCount} total
          </div>
        </div>
      </div>

      {preview.summary && (
        <p className="mt-3 line-clamp-3 text-sm text-slate-700">
          {preview.summary}
        </p>
      )}

      {tooFew && (
        <div className="mt-4 rounded-lg border-[2.5px] border-slate-900 bg-accent-yellow p-2 text-xs font-bold text-slate-900">
          Only {categoryCount} useful{" "}
          {categoryCount === 1 ? "category" : "categories"}. The round may
          be rough — pick something else if you can.
        </div>
      )}

      <div className="mt-4 text-xs font-extrabold uppercase tracking-widest text-slate-600">
        Categories everyone sees
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {preview.categories.length === 0 ? (
          <span className="text-sm italic text-slate-500">None.</span>
        ) : (
          preview.categories.map((c) => (
            <span
              key={c}
              className="rounded-full border-[2.5px] border-slate-900 bg-white px-2.5 py-0.5 text-xs font-bold text-slate-900"
            >
              {c}
            </span>
          ))
        )}
      </div>

      <div className="mt-5 text-xs font-extrabold uppercase tracking-widest text-slate-600">
        Your own hints{" "}
        <span className="font-medium text-slate-400 normal-case tracking-normal">
          (optional — shown in green to guessers)
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {customHints.map((h) => (
          <span
            key={h}
            className="inline-flex items-center gap-1 rounded-full border-[2.5px] border-slate-900 bg-accent-green px-2.5 py-0.5 text-xs font-extrabold text-slate-900"
          >
            {h}
            <button
              type="button"
              onClick={() => removeHint(h)}
              className="brut-btn-chip bg-white p-0.5"
              aria-label={`Remove ${h}`}
            >
              <X className="h-3 w-3" strokeWidth={3} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={hintDraft}
          onChange={(e) => setHintDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addHint();
            }
          }}
          placeholder="Add a custom hint…"
          disabled={submitting || customHints.length >= 10}
          maxLength={120}
          className="brut-input flex-1 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addHint}
          disabled={
            submitting || !hintDraft.trim() || customHints.length >= 10
          }
          className="brut-btn brut-btn-sm bg-accent-green text-slate-900"
        >
          <Plus className="h-4 w-4" strokeWidth={3} /> Add
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={cancelPreview}
          disabled={submitting}
          className="brut-btn brut-btn-sm bg-white text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Pick a
          different one
        </button>
        <button
          type="button"
          onClick={lockIn}
          disabled={submitting || preview.categories.length === 0}
          className="brut-btn bg-accent-yellow text-slate-900"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <Check className="h-4 w-4" strokeWidth={3} />
          )}
          Lock in & start round
        </button>
      </div>
    </div>
  );
}

function ActivePhase({
  round,
  amPicker,
  iAlreadyGuessed,
}: {
  round: NonNullable<LobbyState["currentRound"]>;
  amPicker: boolean;
  iAlreadyGuessed: boolean;
}) {
  if (amPicker) {
    return (
      <div>
        <span className="brut-sticker bg-accent-sky text-slate-900">
          Your pick
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Wait while everyone guesses your article. You can&rsquo;t guess
          your own pick, but chat works.
        </p>
        <CategoriesList
          cats={round.categories ?? []}
          customHints={round.customHints ?? []}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="brut-sticker bg-accent-yellow text-slate-900">
          Guess
        </span>
        {iAlreadyGuessed && (
          <span className="brut-sticker bg-accent-green text-slate-900">
            You got it
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        Type your guess in the chat on the right. Exact and close matches
        count.
      </p>
      <CategoriesList
        cats={round.categories ?? []}
        customHints={round.customHints ?? []}
      />
    </div>
  );
}

function CategoriesList({
  cats,
  customHints,
}: {
  cats: string[];
  customHints: string[];
}) {
  const custom = customHints.map((text) => ({ text, custom: true as const }));
  const wiki = [...cats]
    .sort((a, b) => a.localeCompare(b))
    .map((text) => ({ text, custom: false as const }));
  const hints = [...custom, ...wiki];
  if (hints.length === 0) {
    return (
      <p className="mt-4 text-sm italic text-slate-500">No categories yet.</p>
    );
  }
  return (
    <p
      className="mt-4 text-[17px] leading-[1.9] text-slate-900"
      style={{ textWrap: "pretty" }}
    >
      {hints.map((h, i) => (
        <span key={`${h.text}-${i}`} className="whitespace-normal">
          <span
            className={
              h.custom
                ? "rounded-sm bg-accent-green/45 px-1 font-bold text-slate-900"
                : "font-medium"
            }
          >
            {h.text}
          </span>
          {i < hints.length - 1 && (
            <span
              className="mx-2.5 inline-block align-middle text-amber-400/80"
              aria-hidden
            >
              ✦
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

function RevealPhase({
  code,
  reveal,
  isHost,
  isLastRound,
  onRefresh,
}: {
  code: string;
  reveal: NonNullable<LobbyState["lastReveal"]>;
  isHost: boolean;
  isLastRound: boolean;
  onRefresh: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance() {
    setAdvancing(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${code}/next`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Couldn't advance");
        return;
      }
      onRefresh();
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="brut-sticker bg-accent-green text-slate-900">
          Reveal
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {reveal.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reveal.thumbnailUrl}
            alt={reveal.title ?? ""}
            className="h-40 w-full shrink-0 rounded-lg border-[3px] border-slate-900 object-cover sm:h-auto sm:w-44"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-3xl text-slate-900">
            {reveal.title ?? "(no article)"}
          </div>
          {reveal.summary && (
            <p className="mt-2 line-clamp-4 text-sm text-slate-700">
              {reveal.summary}
            </p>
          )}
          {reveal.url && (
            <a
              href={reveal.url}
              target="_blank"
              rel="noreferrer"
              className="brut-btn brut-btn-sm mt-3 inline-flex bg-white text-slate-900"
            >
              Open Wikipedia{" "}
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} />
            </a>
          )}
        </div>
      </div>
      {(reveal.categories.length > 0 ||
        (reveal.customHints?.length ?? 0) > 0) && (
        <div className="mt-5 border-t-[3px] border-slate-900 pt-4">
          <CategoriesList
            cats={reveal.categories}
            customHints={reveal.customHints ?? []}
          />
        </div>
      )}
      <div className="mt-5 flex items-center justify-end gap-3">
        {error && (
          <span className="text-xs font-bold text-accent-red">{error}</span>
        )}
        {isHost ? (
          <button
            type="button"
            onClick={advance}
            disabled={advancing}
            className="brut-btn bg-accent-yellow text-slate-900"
          >
            {advancing ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={3} />
            )}
            {isLastRound ? "See final scores" : "Next round"}
          </button>
        ) : (
          <p className="text-sm font-bold text-slate-500">
            Waiting for the host to start the next round…
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Scoreboard ----------

function Scoreboard({ members }: { members: LobbyMemberDTO[] }) {
  const ranked = [...members].sort(
    (a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)
  );
  return (
    <div className="brut-card bg-white p-4">
      <div className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
        Scores
      </div>
      <ul className="mt-2 space-y-1.5">
        {ranked.map((m, i) => (
          <li
            key={m.id}
            className={`flex items-center gap-2 rounded-md border-2 border-slate-900 px-2 py-1.5 ${
              m.isMe ? "bg-accent-yellow" : "bg-paper/50"
            }`}
          >
            <span className="w-5 font-display text-sm text-slate-500">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
              {m.displayName}
              {m.isHost && (
                <Crown
                  className="ml-1 inline h-3 w-3 text-accent-pink"
                  strokeWidth={3}
                />
              )}
            </span>
            <span className="tabular-nums text-sm font-extrabold text-slate-900">
              {m.score}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Chat ----------

function ChatBox({
  code,
  state,
  amPicker,
  iAlreadyGuessed,
  roundActive,
  typingAt,
}: {
  code: string;
  state: LobbyState;
  amPicker: boolean;
  iAlreadyGuessed: boolean;
  roundActive: boolean;
  typingAt: Record<string, number>;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastTypingEmitRef = useRef<number>(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages.length]);

  const placeholder = !roundActive
    ? "Chat…"
    : amPicker
      ? "Chat with guessers…"
      : iAlreadyGuessed
        ? "You got it — just chat now"
        : "Type your guess…";

  function emitTyping() {
    const p = getPusherClient();
    if (!p) return;
    const ch = p.channel(lobbyChannelName(code));
    if (!ch) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 2000) return;
    lastTypingEmitRef.current = now;
    try {
      (ch as unknown as {
        trigger: (event: string, data: unknown) => boolean;
      }).trigger("client-typing", {});
    } catch {
      // ignore — not all channel states support client events
    }
  }

  function emitStop() {
    const p = getPusherClient();
    if (!p) return;
    const ch = p.channel(lobbyChannelName(code));
    if (!ch) return;
    lastTypingEmitRef.current = 0;
    try {
      (ch as unknown as {
        trigger: (event: string, data: unknown) => boolean;
      }).trigger("client-stop-typing", {});
    } catch {
      // ignore
    }
  }

  async function send() {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/lobbies/${code}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setValue("");
        emitStop();
      }
    } finally {
      setSending(false);
    }
  }

  // Compose typing indicator. Exclude me.
  const typingNames = Object.keys(typingAt)
    .filter((id) => id !== state.me?.id)
    .map(
      (id) => state.members.find((m) => m.id === id)?.displayName ?? null
    )
    .filter((n): n is string => !!n);

  return (
    <div className="brut-card flex h-[440px] flex-col overflow-hidden bg-white p-0">
      <div className="border-b-[3px] border-slate-900 bg-accent-sky px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-slate-900">
        Chat
      </div>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-sm"
      >
        {state.messages.length === 0 ? (
          <p className="text-center text-xs italic text-slate-400">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {state.messages.map((m) => (
              <ChatLine key={m.id} m={m} />
            ))}
          </ul>
        )}
      </div>
      <div className="min-h-[18px] border-t border-slate-200 px-3 py-0.5 text-[11px] font-semibold italic text-slate-500">
        {formatTypingIndicator(typingNames)}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-stretch gap-1 border-t-[3px] border-slate-900 p-2"
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.trim()) emitTyping();
          }}
          onBlur={emitStop}
          placeholder={placeholder}
          maxLength={200}
          className="min-w-0 flex-1 rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent-yellow"
        />
        <button
          type="submit"
          disabled={sending || !value.trim()}
          data-silent
          className="brut-btn brut-btn-sm brut-btn-icon bg-accent-yellow text-slate-900"
          aria-label="Send"
        >
          <Send className="h-4 w-4" strokeWidth={3} />
        </button>
      </form>
    </div>
  );
}

function formatTypingIndicator(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} players are typing…`;
}

function ChatLine({ m }: { m: LobbyMessageDTO }) {
  if (m.type === "SYSTEM") {
    return (
      <li className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
        {m.text ?? (m.points ? `Picker bonus +${m.points}` : "…")}
      </li>
    );
  }
  if (m.type === "CORRECT_GUESS") {
    return (
      <li className="rounded bg-accent-green/30 px-2 py-1 text-xs font-extrabold text-slate-900">
        <Check
          className="mr-1 inline h-3 w-3 -translate-y-px"
          strokeWidth={3}
        />
        {m.displayName} got it{m.points ? ` · +${m.points}` : ""}
      </li>
    );
  }
  return (
    <li className="rounded px-1 py-0.5">
      <span className="font-bold text-slate-900">{m.displayName}:</span>{" "}
      <span className="text-slate-800">{m.text}</span>
    </li>
  );
}

// ---------- End screen ----------

function EndScreen({ state }: { state: LobbyState }) {
  const scores = state.finalScores ?? [];
  const winner = scores[0];

  return (
    <section className="brut-card bg-white p-6 sm:p-8">
      <div className="text-center">
        <div className="text-6xl">🏆</div>
        <div className="mt-2 text-xs font-extrabold uppercase tracking-widest text-slate-500">
          Game over
        </div>
        <div className="mt-1 font-display text-4xl text-slate-900">
          {winner ? `${winner.displayName} wins!` : "Nobody scored."}
        </div>
      </div>
      <ol className="mt-6 space-y-2">
        {scores.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-lg border-[2.5px] border-slate-900 px-3 py-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 font-display text-xs text-slate-600">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-lg text-slate-900">
              {s.displayName}
              {i === 0 && (
                <Trophy
                  className="ml-1 inline h-4 w-4 text-accent-yellow"
                  fill="currentColor"
                  strokeWidth={2}
                />
              )}
            </span>
            <span className="tabular-nums text-lg font-extrabold text-slate-900">
              {s.score}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/multiplayer" className="brut-btn bg-accent-yellow text-slate-900">
          New lobby
        </Link>
        <Link href="/" className="brut-btn bg-white text-slate-900">
          Dashboard
        </Link>
      </div>
    </section>
  );
}

// ---------- Join gate ----------

function JoinGate({
  code,
  state,
  onJoined,
}: {
  code: string;
  state: LobbyState;
  onJoined: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { displayName: string | null } | null) => {
        if (d?.displayName) setDisplayName(d.displayName);
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          password: password || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Couldn't join");
        return;
      }
      onJoined();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <Link
        href="/multiplayer"
        className="brut-btn brut-btn-sm bg-white text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Back
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="brut-card mt-6 bg-white p-6"
      >
        <div className="flex items-center gap-2">
          <span className="brut-sticker bg-accent-pink text-slate-900">
            Join
          </span>
          <span className="brut-pill bg-white font-mono tracking-[0.3em] text-slate-900">
            {code}
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl text-slate-900">
          Pick your name
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {state.memberCount} {state.memberCount === 1 ? "player" : "players"}{" "}
          in the lobby.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Display name
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            placeholder="e.g. dragon"
            autoFocus
            className="brut-input mt-2 block w-full"
          />
        </label>

        {state.hasPassword && (
          <label className="mt-4 block">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Lobby password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="brut-input mt-2 block w-full"
            />
          </label>
        )}

        {error && (
          <div className="mt-4 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={busy || !displayName.trim()}
            className="brut-btn bg-accent-yellow text-slate-900"
          >
            {busy && (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            )}
            Enter lobby
          </button>
        </div>
      </form>
    </main>
  );
}
