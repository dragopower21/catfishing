"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Crown,
  Gamepad2,
  Loader2,
  Lock,
  Play,
  Share2,
  Users,
} from "lucide-react";
import {
  getPusherClient,
  lobbyChannelName,
  pusherClientConfigured,
} from "@/lib/pusherClient";
import type { LobbyState } from "@/lib/types";

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

  // Subscribe to Pusher presence channel when we're a member.
  useEffect(() => {
    if (!state?.me) return;
    if (!pusherClientConfigured()) return;
    const p = getPusherClient();
    if (!p) return;
    const ch = p.subscribe(lobbyChannelName(code));
    const onRefresh = () => refresh();
    ch.bind("member-joined", onRefresh);
    ch.bind("member-left", onRefresh);
    return () => {
      ch.unbind("member-joined", onRefresh);
      ch.unbind("member-left", onRefresh);
      p.unsubscribe(lobbyChannelName(code));
    };
  }, [state?.me, code, refresh]);

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
    return (
      <JoinGate
        code={code}
        state={state}
        onJoined={refresh}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <LobbyHeader code={code} state={state} router={router} />

      {state.status === "WAITING" ? (
        <WaitingRoom code={code} state={state} onRefresh={refresh} />
      ) : (
        <div className="brut-card bg-accent-yellow p-5">
          <p className="font-semibold text-slate-900">
            Game started — but the gameplay screen arrives in Stage 2.
            Hang tight.
          </p>
        </div>
      )}
    </main>
  );
}

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
      <div className="flex items-center gap-2">
        <span className="brut-pill bg-white text-slate-900">
          <Gamepad2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          {state.mode === "FREESTYLE" ? "Freestyle" : "Set"}
        </span>
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
  void code;
  const canStart = me.isHost && state.memberCount >= 2;

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
          <li
            key={m.id}
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
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-end gap-2">
        {me.isHost ? (
          <>
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                alert(
                  "Gameplay arrives in Stage 2 — waiting room + real-time is all that's wired up so far."
                );
                onRefresh();
              }}
              className="brut-btn bg-accent-yellow text-slate-900"
            >
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={3} />
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
