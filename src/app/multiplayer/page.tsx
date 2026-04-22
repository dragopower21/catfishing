"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dice5,
  Gamepad2,
  LayoutGrid,
  Loader2,
  Lock,
  LogIn,
  Plus,
  Users,
} from "lucide-react";
import type { SetSummary } from "@/lib/types";

type Mode = "FREESTYLE" | "SET_BASED";

export default function MultiplayerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border-[3px] border-slate-900 bg-white px-4 py-1.5 brut-shadow-sm">
          <Gamepad2
            className="h-4 w-4 text-accent-pink"
            strokeWidth={2.5}
            fill="currentColor"
          />
          <span className="font-display text-xs uppercase tracking-widest text-slate-900">
            Multiplayer
          </span>
        </div>
        <h1 className="mt-4 font-display text-5xl leading-[0.95] text-slate-900 sm:text-6xl">
          Play with friends.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base font-medium text-slate-700">
          Spin up a lobby, share the code, guess Wikipedia articles together
          in real time.
        </p>
      </header>

      <div className="mb-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setTab("create")}
          className={`brut-btn ${
            tab === "create"
              ? "bg-accent-yellow text-slate-900"
              : "bg-white text-slate-900"
          }`}
        >
          <Plus className="h-4 w-4" strokeWidth={3} /> Create lobby
        </button>
        <button
          type="button"
          onClick={() => setTab("join")}
          className={`brut-btn ${
            tab === "join"
              ? "bg-accent-yellow text-slate-900"
              : "bg-white text-slate-900"
          }`}
        >
          <LogIn className="h-4 w-4" strokeWidth={2.5} /> Join with code
        </button>
      </div>

      {tab === "create" ? <CreateForm router={router} /> : <JoinForm router={router} />}
    </main>
  );
}

function CreateForm({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  const [mode, setMode] = useState<Mode>("FREESTYLE");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roundDuration, setRoundDuration] = useState(80);
  const [totalRounds, setTotalRounds] = useState(8);
  const [setId, setSetId] = useState<string>("");
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    const res = await fetch("/api/sets");
    if (res.ok) {
      const data = (await res.json()) as SetSummary[];
      setSets(data.filter((s) => !s.hidden && s.articleCount > 0));
    }
  }, []);

  useEffect(() => {
    // Preload name from profile + load playable sets.
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { displayName: string | null } | null) => {
        if (d?.displayName) setDisplayName(d.displayName);
      })
      .catch(() => {});
    loadSets();
  }, [loadSets]);

  useEffect(() => {
    if (mode === "FREESTYLE") setRoundDuration(80);
    else setRoundDuration(60);
  }, [mode]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        mode,
        displayName,
        password: password || undefined,
        roundDuration,
        totalRounds,
      };
      if (mode === "SET_BASED") {
        if (!setId) {
          setError("Pick a set to use for this mode.");
          setBusy(false);
          return;
        }
        body.setId = setId;
      }
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Failed to create lobby");
        return;
      }
      const data = (await res.json()) as { code: string };
      router.push(`/multiplayer/${data.code}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="brut-card bg-white p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeTile
          icon={Dice5}
          active={mode === "FREESTYLE"}
          title="Freestyle"
          body="Players rotate as picker. Pick any Wikipedia article, everyone guesses in chat."
          onClick={() => setMode("FREESTYLE")}
        />
        <ModeTile
          icon={LayoutGrid}
          active={mode === "SET_BASED"}
          title="Play a set"
          body="Auto-advance through a public set. Everyone guesses each article together."
          onClick={() => setMode("SET_BASED")}
        />
      </div>

      {mode === "SET_BASED" && (
        <label className="mt-5 block">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Set
          </span>
          {sets === null ? (
            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
              Loading sets…
            </div>
          ) : sets.length === 0 ? (
            <div className="mt-2 rounded-lg border-[2.5px] border-slate-900 bg-accent-yellow p-3 text-sm font-semibold text-slate-900">
              No playable sets on the server yet. Create one first from the
              dashboard.
            </div>
          ) : (
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              className="brut-input mt-2 block w-full"
            >
              <option value="">Pick a set…</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.articleCount} articles
                  {s.difficultyScore ? `, ${s.difficultyScore}/10` : ""})
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      <label className="mt-5 block">
        <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
          Your name in the lobby
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="e.g. dragon"
          className="brut-input mt-2 block w-full"
        />
      </label>

      <div
        className={`mt-4 grid gap-4 ${
          mode === "FREESTYLE" ? "sm:grid-cols-2" : ""
        }`}
      >
        <label className="block">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            Round duration
          </span>
          <select
            value={roundDuration}
            onChange={(e) => setRoundDuration(Number(e.target.value))}
            className="brut-input mt-2 block w-full"
          >
            {(mode === "FREESTYLE"
              ? [30, 60, 80, 120, 180]
              : [30, 45, 60, 90, 120]
            ).map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </select>
        </label>
        {mode === "FREESTYLE" ? (
          <label className="block">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Rounds
            </span>
            <input
              type="number"
              min={1}
              max={30}
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value) || 8)}
              className="brut-input mt-2 block w-full"
            />
          </label>
        ) : setId ? (
          <div className="mt-2 rounded-lg border-[2.5px] border-slate-900 bg-paper px-3 py-2 text-xs font-bold text-slate-700">
            One round per article —{" "}
            <span className="text-slate-900">
              {sets?.find((s) => s.id === setId)?.articleCount ?? "?"} rounds
            </span>
          </div>
        ) : null}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
          Lobby password{" "}
          <span className="font-medium text-slate-400 normal-case tracking-normal">
            (optional)
          </span>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank for a public lobby (still requires the code)"
          className="brut-input mt-2 block w-full"
        />
      </label>

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
          {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          Create lobby
        </button>
      </div>
    </form>
  );
}

function JoinForm({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  const [code, setCode] = useState("");

  function submit() {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z]{4,8}$/.test(normalized)) return;
    router.push(`/multiplayer/${normalized}`);
  }

  return (
    <form
      className="brut-card bg-white p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block">
        <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
          Lobby code
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          placeholder="e.g. ABXKJD"
          autoFocus
          className="brut-input mt-2 block w-full font-mono text-2xl uppercase tracking-[0.4em]"
        />
      </label>
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={!/^[A-Z]{4,8}$/.test(code.trim().toUpperCase())}
          className="brut-btn bg-accent-yellow text-slate-900"
        >
          <LogIn className="h-4 w-4" strokeWidth={2.5} /> Enter lobby
        </button>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Users className="h-3.5 w-3.5" strokeWidth={2.5} /> Lobbies are
        invite-only — you need the code.
      </p>
      <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Lock className="h-3.5 w-3.5" strokeWidth={2.5} /> If the lobby has a
        password, you&rsquo;ll be asked for it after you enter the code.
      </p>
    </form>
  );
}

function ModeTile({
  icon: Icon,
  active,
  title,
  body,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-silent
      className={`brut-card-link flex min-h-32 flex-col p-4 text-left ${
        active ? "bg-accent-sky" : "bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border-[3px] border-slate-900 bg-white">
          <Icon className="h-4 w-4 text-slate-900" strokeWidth={2.5} />
        </div>
        <div className="font-display text-lg text-slate-900">{title}</div>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-700">{body}</p>
    </button>
  );
}
