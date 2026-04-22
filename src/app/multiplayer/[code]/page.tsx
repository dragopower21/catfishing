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
  Send,
  Share2,
  Trophy,
  Users,
} from "lucide-react";
import WikipediaAutocomplete from "@/components/WikipediaAutocomplete";
import {
  getPusherClient,
  lobbyChannelName,
  pusherClientConfigured,
} from "@/lib/pusherClient";
import { sound } from "@/lib/sound";
import type {
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to Pusher presence channel once we're a member.
  useEffect(() => {
    if (!state?.me) return;
    if (!pusherClientConfigured()) return;
    const p = getPusherClient();
    if (!p) return;
    const ch = p.subscribe(lobbyChannelName(code));

    // Any significant state event → refetch full state. Keeps UI simple.
    const bust = () => refresh();
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

    // Chat doesn't need a full refresh — append the message locally.
    ch.bind("chat-message", (msg: LobbyMessageDTO) => {
      setState((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev
      );
    });

    return () => {
      events.forEach((e) => ch.unbind(e));
      ch.unbind("chat-message");
      p.unsubscribe(lobbyChannelName(code));
    };
  }, [state?.me, code, refresh]);

  // Play sound when we hear about a correct guess (subtle)
  useEffect(() => {
    if (!state?.me) return;
    if (!pusherClientConfigured()) return;
    const p = getPusherClient();
    if (!p) return;
    const ch = p.channel(lobbyChannelName(code));
    if (!ch) return;
    const onCorrect = () => sound.correct();
    ch.bind("correct-guess", onCorrect);
    return () => {
      ch.unbind("correct-guess", onCorrect);
    };
  }, [state?.me, code]);

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
      <LobbyHeader code={code} state={state} router={router} />

      {state.status === "WAITING" ? (
        <WaitingRoom code={code} state={state} onRefresh={refresh} />
      ) : state.status === "IN_GAME" ? (
        <GameScreen code={code} state={state} onRefresh={refresh} />
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
}: {
  code: string;
  state: LobbyState;
  router: ReturnType<typeof useRouter>;
}) {
  const [copied, setCopied] = useState(false);

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
            <Share2 className="h-4 w-4" strokeWidth={2.5} /> Share link
          </>
        )}
      </button>
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
}: {
  code: string;
  state: LobbyState;
  onRefresh: () => void;
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

  // Kick a tick when the timer hits zero so the server ends the round / advances.
  const tickedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!round) return;
    if (remainingMs === null) return;
    if (remainingMs > 0) return;
    const key = `${round.id}:${round.status}`;
    if (tickedRef.current === key) return;
    tickedRef.current = key;
    fetch(`/api/lobbies/${code}/tick`, { method: "POST" })
      .catch(() => {})
      .finally(() => onRefresh());
  }, [round, remainingMs, code, onRefresh]);

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
                remainingSec !== null && remainingSec <= 10
                  ? "text-accent-red"
                  : "text-slate-900"
              }`}
            >
              {remainingSec === null ? "—" : `${remainingSec}s`}
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
            <RevealPhase reveal={state.lastReveal} nextIn={remainingSec} />
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(urlOrTitle: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${code}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrTitle }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Pick failed");
        // If the server disagrees about whose turn it is, the client
        // is probably stale — pull fresh state to resolve.
        if (res.status === 403 || res.status === 409) {
          onRefresh();
        }
      }
    } finally {
      setSubmitting(false);
    }
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
          onSubmit={submit}
          loading={submitting}
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
        <CategoriesList cats={round.categories ?? []} />
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
      <CategoriesList cats={round.categories ?? []} />
    </div>
  );
}

function CategoriesList({ cats }: { cats: string[] }) {
  if (cats.length === 0) {
    return (
      <p className="mt-4 text-sm italic text-slate-500">
        No categories yet.
      </p>
    );
  }
  const sorted = [...cats].sort((a, b) => a.localeCompare(b));
  return (
    <p
      className="mt-4 text-[17px] leading-[1.9] text-slate-900"
      style={{ textWrap: "pretty" }}
    >
      {sorted.map((c, i) => (
        <span key={`${c}-${i}`} className="whitespace-normal">
          <span className="font-medium">{c}</span>
          {i < sorted.length - 1 && (
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
  reveal,
  nextIn,
}: {
  reveal: NonNullable<LobbyState["lastReveal"]>;
  nextIn: number | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="brut-sticker bg-accent-green text-slate-900">
          Reveal
        </span>
        {nextIn !== null && nextIn > 0 && (
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Next round in {nextIn}s
          </span>
        )}
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
}: {
  code: string;
  state: LobbyState;
  amPicker: boolean;
  iAlreadyGuessed: boolean;
  roundActive: boolean;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

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
      }
    } finally {
      setSending(false);
    }
  }

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-stretch gap-1 border-t-[3px] border-slate-900 p-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
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
